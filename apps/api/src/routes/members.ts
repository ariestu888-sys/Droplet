import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  AcceptInvitationResultSchema,
  ApiErrorSchema,
  CreateInvitationResultSchema,
  CreateInvitationSchema,
  InvitationDetailsSchema,
  InvitationListSchema,
  MemberListSchema,
  ROLE_LABELS,
  SubscribeResultSchema,
  UpdateMemberRoleSchema,
  type Invitation,
  type InvitableRole,
  type InvitationDetails,
  type OrganizationRole,
} from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException, databaseError } from "../lib/errors";
import { invitationEmail, sendEmail } from "../lib/email";
import { publicLogoUrl } from "../lib/images";
import { publicClient } from "../lib/supabase";
import { env } from "../env";

type InvitationRow = {
  id: string;
  email: string;
  role: InvitableRole;
  token: string;
  created_at: string;
  expires_at: string;
};

const inviteUrl = (token: string) => `${env.PUBLIC_SITE_URL.replace(/\/+$/, "")}/invite/${token}`;

const toInvitation = (row: InvitationRow): Invitation => ({
  id: row.id,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  inviteUrl: inviteUrl(row.token),
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
  .openapi({ param: { name: "token", in: "path" }, description: "The secret token from an invite link." });

const listMembers = createRoute({
  method: "get",
  path: "/organizations/{id}/members",
  tags: ["Members"],
  summary: "List an organization's members with names, emails and roles (organizers)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "Most access first", content: { "application/json": { schema: MemberListSchema } } },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer"),
  },
});

const updateMemberRole = createRoute({
  method: "patch",
  path: "/organizations/{id}/members/{userId}",
  tags: ["Members"],
  summary: "Change a member's role",
  description: "Owners can give any role but owner (and change admins); admins can move people between booster, member and subscriber. Nobody can change their own role.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id"), userId: uuidParam("userId") }),
    body: { required: true, content: { "application/json": { schema: UpdateMemberRoleSchema } } },
  },
  responses: {
    204: { description: "Changed" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not allowed to give or take away that role"),
    404: errorResponse("Not a member of this organization"),
  },
});

const removeMember = createRoute({
  method: "delete",
  path: "/organizations/{id}/members/{userId}",
  tags: ["Members"],
  summary: "Remove someone from an organization (same rules as changing their role)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id"), userId: uuidParam("userId") }) },
  responses: {
    204: { description: "Removed" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not allowed to remove that person"),
    404: errorResponse("Not a member of this organization"),
  },
});

const leaveOrganization = createRoute({
  method: "post",
  path: "/organizations/{id}/leave",
  tags: ["Members"],
  summary: "Leave an organization (anyone but the owner)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    204: { description: "Left" },
    401: errorResponse("Not signed in"),
    403: errorResponse("The owner can't leave"),
    404: errorResponse("Not in this organization"),
  },
});

const subscribe = createRoute({
  method: "post",
  path: "/organizations/{id}/subscribe",
  tags: ["Members"],
  summary: "Subscribe to an organization's updates",
  description: "Joins as a subscriber. People already in the organization keep their role.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "Your role afterwards", content: { "application/json": { schema: SubscribeResultSchema } } },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such organization"),
  },
});

const listInvitations = createRoute({
  method: "get",
  path: "/organizations/{id}/invitations",
  tags: ["Invitations"],
  summary: "List pending invitations (organizers)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "Newest first", content: { "application/json": { schema: InvitationListSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const createInvitation = createRoute({
  method: "post",
  path: "/organizations/{id}/invitations",
  tags: ["Invitations"],
  summary: "Invite someone by email with a role",
  description:
    "Owners can invite any role but owner; admins can invite boosters, members and subscribers. Replaces a pending invite for the same email. The invite is emailed when email is configured; inviteUrl is always returned to share by hand. Links expire after 14 days.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id") }),
    body: { required: true, content: { "application/json": { schema: CreateInvitationSchema } } },
  },
  responses: {
    201: { description: "The invitation", content: { "application/json": { schema: CreateInvitationResultSchema } } },
    400: errorResponse("Invalid email or role"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not allowed to invite that role"),
  },
});

const revokeInvitation = createRoute({
  method: "delete",
  path: "/invitations/{id}",
  tags: ["Invitations"],
  summary: "Cancel a pending invitation",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    204: { description: "Cancelled" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not allowed"),
  },
});

const getInvitation = createRoute({
  method: "get",
  path: "/public/invitations/{token}",
  tags: ["Invitations"],
  summary: "What an invite link shows (no sign-in needed)",
  request: { params: z.object({ token: tokenParam }) },
  responses: {
    200: { description: "The invitation", content: { "application/json": { schema: InvitationDetailsSchema } } },
    404: errorResponse("No such invitation"),
  },
});

const acceptInvitation = createRoute({
  method: "post",
  path: "/invitations/{token}/accept",
  tags: ["Invitations"],
  summary: "Accept an invitation as the signed-in user",
  description: "The signed-in user's email must match the invitation's. Joins the organization, or raises an existing member's role (never lowers it).",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ token: tokenParam }) },
  responses: {
    200: { description: "Joined", content: { "application/json": { schema: AcceptInvitationResultSchema } } },
    400: errorResponse("Expired, used or cancelled"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Sent to a different email address"),
    404: errorResponse("No such invitation"),
  },
});

export const members = new OpenAPIHono<{ Variables: AuthVariables }>()
  .openapi(listMembers, async (c) => {
    const { id } = c.req.valid("param");
    const { data, error } = await c.var.supabase.rpc("list_organization_members", { org_id: id });
    if (error) throw databaseError(error);
    const rows = data as { user_id: string; full_name: string | null; email: string | null; role: OrganizationRole; joined_at: string }[];
    return c.json(
      { data: rows.map((m) => ({ userId: m.user_id, fullName: m.full_name, email: m.email, role: m.role, joinedAt: m.joined_at })) },
      200,
    );
  })
  .openapi(updateMemberRole, async (c) => {
    const { id, userId } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const { error } = await c.var.supabase.rpc("set_member_role", { org_id: id, target_user: userId, new_role: role });
    if (error) throw databaseError(error);
    return c.body(null, 204);
  })
  .openapi(removeMember, async (c) => {
    const { id, userId } = c.req.valid("param");
    const { error } = await c.var.supabase.rpc("remove_member", { org_id: id, target_user: userId });
    if (error) throw databaseError(error);
    return c.body(null, 204);
  })
  .openapi(leaveOrganization, async (c) => {
    const { id } = c.req.valid("param");
    const { error } = await c.var.supabase.rpc("leave_organization", { org_id: id });
    if (error) throw databaseError(error);
    return c.body(null, 204);
  })
  .openapi(subscribe, async (c) => {
    const { id } = c.req.valid("param");
    const { data, error } = await c.var.supabase.rpc("subscribe_to_organization", { org_id: id });
    if (error) throw databaseError(error);
    return c.json({ role: data as OrganizationRole }, 200);
  })
  .openapi(listInvitations, async (c) => {
    const { id } = c.req.valid("param");
    const { data, error } = await c.var.supabase
      .from("organization_invitations")
      .select("id, email, role, token, created_at, expires_at")
      .eq("organization_id", id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .overrideTypes<InvitationRow[], { merge: false }>();
    if (error) throw databaseError(error);
    return c.json({ data: data.map(toInvitation) }, 200);
  })
  .openapi(createInvitation, async (c) => {
    const { id } = c.req.valid("param");
    const { email, role } = c.req.valid("json");

    const { data, error } = await c.var.supabase
      .rpc("create_invitation", { org_id: id, invite_email: email, invite_role: role })
      .single<InvitationRow>();
    if (error) throw databaseError(error);
    const invitation = toInvitation(data);

    const { data: org } = await c.var.supabase.from("organizations").select("name").eq("id", id).maybeSingle<{ name: string }>();
    const emailSent = await sendEmail({
      to: email,
      ...invitationEmail({ organizationName: org?.name ?? "an organization", roleLabel: ROLE_LABELS[role], inviteUrl: invitation.inviteUrl }),
    });

    return c.json({ invitation, emailSent }, 201);
  })
  .openapi(revokeInvitation, async (c) => {
    const { id } = c.req.valid("param");
    const { error } = await c.var.supabase.rpc("revoke_invitation", { invitation_id: id });
    if (error) throw databaseError(error);
    return c.body(null, 204);
  })
  .openapi(getInvitation, async (c) => {
    const { token } = c.req.valid("param");
    const { data, error } = await publicClient.rpc("invitation_details", { invite_token: token });
    if (error) throw databaseError(error);
    if (!data) throw new ApiException(404, "not_found", "No such invitation.");

    const row = data as Omit<InvitationDetails, "organization"> & {
      organization: Omit<InvitationDetails["organization"], "logoUrl"> & { logoPath: string | null };
    };
    const { logoPath, ...organization } = row.organization;
    // Invite links are secret; don't let shared caches keep them.
    c.header("Cache-Control", "no-store");
    return c.json({ ...row, organization: { ...organization, logoUrl: publicLogoUrl(logoPath) } }, 200);
  })
  .openapi(acceptInvitation, async (c) => {
    const { token } = c.req.valid("param");
    const { data, error } = await c.var.supabase.rpc("accept_invitation", { invite_token: token });
    if (error) throw databaseError(error);
    return c.json({ organizationId: data as string }, 200);
  });
