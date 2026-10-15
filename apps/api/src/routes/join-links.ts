import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  AcceptInvitationResultSchema,
  ApiErrorSchema,
  CreateJoinLinkSchema,
  JoinLinkDetailsSchema,
  JoinLinkListSchema,
  JoinLinkSchema,
  type JoinLink,
  type JoinLinkDetails,
  type JoinLinkRole,
} from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException, databaseError } from "../lib/errors";
import { publicLogoUrl } from "../lib/images";
import { publicClient } from "../lib/supabase";
import { env } from "../env";

// Join links: shareable links (and QR codes) for joining as a booster,
// member or subscriber.

type JoinLinkRow = { id: string; role: JoinLinkRole; token: string; created_at: string };

const joinUrl = (token: string) => `${env.PUBLIC_SITE_URL.replace(/\/+$/, "")}/join/${token}`;

const toJoinLink = (row: JoinLinkRow): JoinLink => ({
  id: row.id,
  role: row.role,
  url: joinUrl(row.token),
  createdAt: row.created_at,
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

const uuidParam = (name: string) =>
  z.uuid().openapi({ param: { name, in: "path" }, example: "7d3f2c1e-5b8a-4f6e-9c2d-1a0b3e4f5a6b" });

const tokenParam = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .openapi({ param: { name: "token", in: "path" }, description: "The secret token from a join link." });

const listJoinLinks = createRoute({
  method: "get",
  path: "/organizations/{id}/join-links",
  tags: ["Join links"],
  summary: "List active join links (organizers)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "At most one per role", content: { "application/json": { schema: JoinLinkListSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const createJoinLink = createRoute({
  method: "post",
  path: "/organizations/{id}/join-links",
  tags: ["Join links"],
  summary: "Create the join link for a role (organizers)",
  description: "Replaces the role's active link, if any: the old link stops working.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id") }),
    body: { required: true, content: { "application/json": { schema: CreateJoinLinkSchema } } },
  },
  responses: {
    201: { description: "The new link", content: { "application/json": { schema: JoinLinkSchema } } },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer"),
  },
});

const revokeJoinLink = createRoute({
  method: "delete",
  path: "/join-links/{id}",
  tags: ["Join links"],
  summary: "Turn a join link off (organizers)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    204: { description: "Turned off" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not allowed"),
  },
});

const getJoinLink = createRoute({
  method: "get",
  path: "/public/join-links/{token}",
  tags: ["Join links"],
  summary: "What a join link shows (no sign-in needed)",
  request: { params: z.object({ token: tokenParam }) },
  responses: {
    200: { description: "The join link", content: { "application/json": { schema: JoinLinkDetailsSchema } } },
    404: errorResponse("No such join link"),
  },
});

const acceptJoinLink = createRoute({
  method: "post",
  path: "/join-links/{token}/accept",
  tags: ["Join links"],
  summary: "Join an organization through a join link",
  description: "Joins at the link's role, or raises an existing member's role (never lowers it).",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ token: tokenParam }) },
  responses: {
    200: { description: "Joined", content: { "application/json": { schema: AcceptInvitationResultSchema } } },
    400: errorResponse("The link has been turned off"),
    401: errorResponse("Not signed in"),
    404: errorResponse("No such join link"),
  },
});

export const joinLinks = new OpenAPIHono<{ Variables: AuthVariables }>()
  .openapi(listJoinLinks, async (c) => {
    const { id } = c.req.valid("param");
    const { data, error } = await c.var.supabase
      .from("organization_join_links")
      .select("id, role, token, created_at")
      .eq("organization_id", id)
      .is("revoked_at", null)
      .overrideTypes<JoinLinkRow[], { merge: false }>();
    if (error) throw databaseError(error);
    return c.json({ data: data.map(toJoinLink) }, 200);
  })
  .openapi(createJoinLink, async (c) => {
    const { id } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const { data, error } = await c.var.supabase
      .rpc("create_join_link", { org_id: id, link_role: role })
      .single<JoinLinkRow>();
    if (error) throw databaseError(error);
    return c.json(toJoinLink(data), 201);
  })
  .openapi(revokeJoinLink, async (c) => {
    const { id } = c.req.valid("param");
    const { error } = await c.var.supabase.rpc("revoke_join_link", { link_id: id });
    if (error) throw databaseError(error);
    return c.body(null, 204);
  })
  .openapi(getJoinLink, async (c) => {
    const { token } = c.req.valid("param");
    const { data, error } = await publicClient.rpc("join_link_details", { link_token: token });
    if (error) throw databaseError(error);
    if (!data) throw new ApiException(404, "not_found", "No such join link.");

    const row = data as Omit<JoinLinkDetails, "organization"> & {
      organization: Omit<JoinLinkDetails["organization"], "logoUrl"> & { logoPath: string | null };
    };
    const { logoPath, ...organization } = row.organization;
    c.header("Cache-Control", "no-store");
    return c.json({ ...row, organization: { ...organization, logoUrl: publicLogoUrl(logoPath) } }, 200);
  })
  .openapi(acceptJoinLink, async (c) => {
    const { token } = c.req.valid("param");
    const { data, error } = await c.var.supabase.rpc("accept_join_link", { link_token: token });
    if (error) throw databaseError(error);
    return c.json({ organizationId: data as string }, 200);
  });
