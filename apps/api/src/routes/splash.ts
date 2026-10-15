import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CreateSponsorSchema,
  SponsorListSchema,
  SponsorSchema,
  UpdateSplashSchema,
  SplashContentSchema,
  SplashPageSchema,
  type OrganizationRole,
  type Sponsor,
  type SplashPage,
} from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException, databaseError } from "../lib/errors";
import {
  LOGO_BUCKET,
  LOGO_UPLOAD_DESCRIPTION,
  logoBodyLimit,
  logoUploadBody,
  publicLogoUrl,
  readLogoUpload,
} from "../lib/images";
import { hasUnsafeContent, sanitizeSplashHtml } from "../lib/sanitize";
import { publicClient, type UserClient } from "../lib/supabase";

type SponsorRow = {
  id: string;
  organization_id: string;
  name: string;
  website_url: string | null;
  logo_path: string | null;
};

const toSponsor = (row: Pick<SponsorRow, "id" | "name" | "website_url" | "logo_path">): Sponsor => ({
  id: row.id,
  name: row.name,
  websiteUrl: row.website_url,
  logoUrl: publicLogoUrl(row.logo_path),
});

// The signed-in user's role in an organization, or null if not a member.
async function roleIn(supabase: UserClient, userId: string, organizationId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ role: OrganizationRole }>();
  if (error) throw databaseError(error);
  return data?.role ?? null;
}

async function requireOrganizer(supabase: UserClient, userId: string, organizationId: string) {
  const role = await roleIn(supabase, userId, organizationId);
  if (!role) throw new ApiException(404, "not_found", "No such organization.");
  if (role === "member") throw new ApiException(403, "forbidden", "Only organizers can change this.");
}

async function findSponsor(supabase: UserClient, id: string) {
  const { data, error } = await supabase
    .from("organization_sponsors")
    .select("id, organization_id, name, website_url, logo_path")
    .eq("id", id)
    .maybeSingle<SponsorRow>();
  if (error) throw databaseError(error);
  if (!data) throw new ApiException(404, "not_found", "No such sponsor.");
  return data;
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

const uuidParam = (name: string) =>
  z.uuid().openapi({ param: { name, in: "path" }, example: "7d3f2c1e-5b8a-4f6e-9c2d-1a0b3e4f5a6b" });

const getPublicSplash = createRoute({
  method: "get",
  path: "/public/organizations/{slug}/splash",
  tags: ["Splash pages"],
  summary: "An organization's public splash page (no sign-in needed)",
  request: {
    params: z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/i)
        .openapi({ param: { name: "slug", in: "path" }, example: "northfield-esports-club" }),
    }),
  },
  responses: {
    200: { description: "The splash page", content: { "application/json": { schema: SplashPageSchema } } },
    404: errorResponse("No such organization"),
  },
});

const getSplash = createRoute({
  method: "get",
  path: "/organizations/{id}/splash",
  tags: ["Splash pages"],
  summary: "An organization's splash content, for editing (members)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "The splash content", content: { "application/json": { schema: SplashContentSchema } } },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such organization, or the user isn't a member"),
  },
});

const updateSplash = createRoute({
  method: "put",
  path: "/organizations/{id}/splash",
  tags: ["Splash pages"],
  summary: "Replace an organization's splash content (organizers)",
  description:
    "The HTML is sanitized before it's saved: scripts, event handlers, forms and unsafe styles are removed. Embeds are allowed from YouTube and Vimeo. The response has the HTML as saved.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id") }),
    body: { required: true, content: { "application/json": { schema: UpdateSplashSchema } } },
  },
  responses: {
    200: { description: "The splash content as saved", content: { "application/json": { schema: SplashContentSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer"),
    404: errorResponse("No such organization"),
  },
});

const listSponsors = createRoute({
  method: "get",
  path: "/organizations/{id}/sponsors",
  tags: ["Sponsors"],
  summary: "List an organization's sponsors (members)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "In display order", content: { "application/json": { schema: SponsorListSchema } } },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such organization, or the user isn't a member"),
  },
});

const createSponsor = createRoute({
  method: "post",
  path: "/organizations/{id}/sponsors",
  tags: ["Sponsors"],
  summary: "Add a sponsor (organizers)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id") }),
    body: { required: true, content: { "application/json": { schema: CreateSponsorSchema } } },
  },
  responses: {
    201: { description: "The new sponsor", content: { "application/json": { schema: SponsorSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer"),
    404: errorResponse("No such organization"),
  },
});

const deleteSponsor = createRoute({
  method: "delete",
  path: "/sponsors/{id}",
  tags: ["Sponsors"],
  summary: "Remove a sponsor (organizers)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    204: { description: "Removed" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer"),
    404: errorResponse("No such sponsor"),
  },
});

const uploadSponsorLogo = createRoute({
  method: "put",
  path: "/sponsors/{id}/logo",
  tags: ["Sponsors"],
  summary: "Upload or replace a sponsor's logo (organizers)",
  description: LOGO_UPLOAD_DESCRIPTION,
  security: [{ Bearer: [] }],
  middleware: [requireUser, logoBodyLimit] as const,
  request: { params: z.object({ id: uuidParam("id") }), body: logoUploadBody },
  responses: {
    200: { description: "The sponsor, with its new logo", content: { "application/json": { schema: SponsorSchema } } },
    400: errorResponse("Not a PNG, JPEG or WebP image"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer"),
    404: errorResponse("No such sponsor"),
    413: errorResponse("File too large"),
  },
});

type SplashRow = Omit<SplashPage, "organization" | "sponsors"> & {
  organization: Omit<SplashPage["organization"], "logoUrl"> & { logoPath: string | null };
  sponsors: { id: string; name: string; websiteUrl: string | null; logoPath: string | null }[];
};

export const splash = new OpenAPIHono<{ Variables: AuthVariables }>()
  .openapi(getPublicSplash, async (c) => {
    const { slug } = c.req.valid("param");
    const { data, error } = await publicClient.rpc("organization_splash", { org_slug: slug });
    if (error) throw databaseError(error);
    if (!data) throw new ApiException(404, "not_found", "No such organization.");

    const row = data as SplashRow;
    const { logoPath, ...organization } = row.organization;
    const page: SplashPage = {
      ...row,
      organization: { ...organization, logoUrl: publicLogoUrl(logoPath) },
      sponsors: row.sponsors.map((s) => ({
        id: s.id,
        name: s.name,
        websiteUrl: s.websiteUrl,
        logoUrl: publicLogoUrl(s.logoPath),
      })),
    };
    // Shared caches may keep it briefly; organizers' edits show within a minute.
    c.header("Cache-Control", "public, max-age=60");
    return c.json(page, 200);
  })
  .openapi(getSplash, async (c) => {
    const { id } = c.req.valid("param");
    const { data, error } = await c.var.supabase
      .from("organizations")
      .select("splash_html, splash_updated_at")
      .eq("id", id)
      .maybeSingle<{ splash_html: string | null; splash_updated_at: string | null }>();
    if (error) throw databaseError(error);
    if (!data) throw new ApiException(404, "not_found", "No such organization.");
    return c.json({ html: data.splash_html, updatedAt: data.splash_updated_at }, 200);
  })
  .openapi(updateSplash, async (c) => {
    const { id } = c.req.valid("param");
    const { html } = c.req.valid("json");
    await requireOrganizer(c.var.supabase, c.var.userId, id);

    const clean = sanitizeSplashHtml(html);
    const { error } = await c.var.supabase.rpc("set_splash_html", { org_id: id, html: clean });
    if (error) throw databaseError(error);
    return c.json(
      { html: clean || null, updatedAt: new Date().toISOString(), removedUnsafeContent: hasUnsafeContent(html) },
      200,
    );
  })
  .openapi(listSponsors, async (c) => {
    const { id } = c.req.valid("param");
    if (!(await roleIn(c.var.supabase, c.var.userId, id))) {
      throw new ApiException(404, "not_found", "No such organization.");
    }
    const { data, error } = await c.var.supabase
      .from("organization_sponsors")
      .select("id, name, website_url, logo_path")
      .eq("organization_id", id)
      .order("position")
      .order("created_at");
    if (error) throw databaseError(error);
    return c.json({ data: data.map(toSponsor) }, 200);
  })
  .openapi(createSponsor, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    await requireOrganizer(c.var.supabase, c.var.userId, id);

    const { data, error } = await c.var.supabase
      .from("organization_sponsors")
      .insert({ organization_id: id, name: input.name, website_url: input.websiteUrl ?? null })
      .select("id, name, website_url, logo_path")
      .single();
    if (error) throw databaseError(error);
    return c.json(toSponsor(data), 201);
  })
  .openapi(deleteSponsor, async (c) => {
    const { id } = c.req.valid("param");
    const sponsor = await findSponsor(c.var.supabase, id);
    await requireOrganizer(c.var.supabase, c.var.userId, sponsor.organization_id);

    const { error } = await c.var.supabase.from("organization_sponsors").delete().eq("id", id);
    if (error) throw databaseError(error);
    if (sponsor.logo_path) await c.var.supabase.storage.from(LOGO_BUCKET).remove([sponsor.logo_path]);
    return c.body(null, 204);
  })
  .openapi(uploadSponsorLogo, async (c) => {
    const { id } = c.req.valid("param");
    const { file } = c.req.valid("form");
    const { bytes, contentType, extension } = await readLogoUpload(file);

    const sponsor = await findSponsor(c.var.supabase, id);
    await requireOrganizer(c.var.supabase, c.var.userId, sponsor.organization_id);

    // A new file name each time, so browsers and CDNs never show a stale logo.
    const path = `${sponsor.organization_id}/sponsors/${id}-${Date.now()}.${extension}`;
    const storage = c.var.supabase.storage.from(LOGO_BUCKET);
    const upload = await storage.upload(path, bytes, { contentType, upsert: false });
    if (upload.error) {
      console.error(upload.error);
      throw new ApiException(502, "storage_error", "Couldn't store the logo.");
    }

    const { error } = await c.var.supabase.from("organization_sponsors").update({ logo_path: path }).eq("id", id);
    if (error) {
      await storage.remove([path]);
      throw databaseError(error);
    }
    if (sponsor.logo_path) await storage.remove([sponsor.logo_path]);

    return c.json(toSponsor({ ...sponsor, logo_path: path }), 200);
  });
