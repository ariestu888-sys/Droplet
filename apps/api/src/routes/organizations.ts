import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CreateOrganizationSchema,
  OrganizationListSchema,
  OrganizationSchema,
  OrganizationTypeListSchema,
  UpdateOrganizationSchema,
  type Organization,
  type OrganizationRole,
} from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException, databaseError } from "../lib/errors";
import { LOGO_BUCKET, LOGO_UPLOAD_DESCRIPTION, logoBodyLimit, logoUploadBody, publicLogoUrl, readLogoUpload } from "../lib/images";
import type { UserClient } from "../lib/supabase";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  zipcode: string | null;
  address: string | null;
  discord_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  logo_path: string | null;
  splash_primary_color: string | null;
  splash_secondary_color: string | null;
  created_at: string;
  type: { name: string } | null;
};

const ORGANIZATION_COLUMNS =
  "id, name, slug, description, zipcode, address, discord_url, website_url, instagram_url, logo_path, splash_primary_color, splash_secondary_color, created_at, type:organization_types(name)";

const toOrganization = (row: OrganizationRow, role: OrganizationRole): Organization => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  type: row.type?.name ?? "Other",
  description: row.description,
  zipcode: row.zipcode,
  address: row.address,
  discordUrl: row.discord_url,
  websiteUrl: row.website_url,
  instagramUrl: row.instagram_url,
  logoUrl: publicLogoUrl(row.logo_path),
  splashPrimaryColor: row.splash_primary_color,
  splashSecondaryColor: row.splash_secondary_color,
  role,
  createdAt: row.created_at,
});

// One organization, as seen by the signed-in user (null if they aren't a member).
async function findOrganization(supabase: UserClient, userId: string, id: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select(`role, organization:organizations(${ORGANIZATION_COLUMNS})`)
    .eq("user_id", userId)
    .eq("organization_id", id)
    .maybeSingle()
    .overrideTypes<{ role: OrganizationRole; organization: OrganizationRow } | null, { merge: false }>();

  if (error) throw databaseError(error);
  return data ? toOrganization(data.organization, data.role) : null;
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

const IdParams = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" }, example: "7d3f2c1e-5b8a-4f6e-9c2d-1a0b3e4f5a6b" }),
});

const listTypes = createRoute({
  method: "get",
  path: "/organization-types",
  tags: ["Organizations"],
  summary: "List organization types: Droplet's starter list plus custom types people have added",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  responses: {
    200: { description: "Starter types first, then custom ones, A–Z", content: { "application/json": { schema: OrganizationTypeListSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const listOrganizations = createRoute({
  method: "get",
  path: "/organizations",
  tags: ["Organizations"],
  summary: "List the organizations the signed-in user belongs to",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  responses: {
    200: { description: "Newest first", content: { "application/json": { schema: OrganizationListSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const createOrganization = createRoute({
  method: "post",
  path: "/organizations",
  tags: ["Organizations"],
  summary: "Create an organization, owned by the signed-in user",
  description: "If `type` doesn't match an existing type (ignoring case), it's added as a new custom type.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    body: { required: true, content: { "application/json": { schema: CreateOrganizationSchema } } },
  },
  responses: {
    201: { description: "The new organization", content: { "application/json": { schema: OrganizationSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
  },
});

const getOrganization = createRoute({
  method: "get",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Get one organization the signed-in user belongs to",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: IdParams },
  responses: {
    200: { description: "The organization", content: { "application/json": { schema: OrganizationSchema } } },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such organization, or the user isn't a member"),
  },
});

const updateOrganization = createRoute({
  method: "patch",
  path: "/organizations/{id}",
  tags: ["Organizations"],
  summary: "Edit an organization's details (owners and admins)",
  description:
    "Only the fields sent change. Send `null` to clear an optional field. A `type` that doesn't exist yet is added as a custom type.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: UpdateOrganizationSchema } } },
  },
  responses: {
    200: { description: "The updated organization", content: { "application/json": { schema: OrganizationSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an owner or admin of this organization"),
    404: errorResponse("No such organization"),
  },
});

const removeLogo = createRoute({
  method: "delete",
  path: "/organizations/{id}/logo",
  tags: ["Organizations"],
  summary: "Remove an organization's logo (owners and admins)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: IdParams },
  responses: {
    200: { description: "The organization, without a logo", content: { "application/json": { schema: OrganizationSchema } } },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an owner or admin of this organization"),
    404: errorResponse("No such organization"),
  },
});

// Loads an organization the signed-in user can manage, or throws 404/403.
async function findManageableOrganization(supabase: UserClient, userId: string, id: string) {
  const organization = await findOrganization(supabase, userId, id);
  if (!organization) throw new ApiException(404, "not_found", "No such organization.");
  if (organization.role === "member") {
    throw new ApiException(403, "forbidden", "Only owners and admins can change this organization.");
  }
  return organization;
}

const uploadLogo = createRoute({
  method: "put",
  path: "/organizations/{id}/logo",
  tags: ["Organizations"],
  summary: "Upload or replace an organization's logo (owners and admins)",
  description: LOGO_UPLOAD_DESCRIPTION,
  security: [{ Bearer: [] }],
  middleware: [
    requireUser,
    logoBodyLimit,
  ] as const,
  request: {
    params: IdParams,
    body: logoUploadBody,
  },
  responses: {
    200: { description: "The organization, with its new logo", content: { "application/json": { schema: OrganizationSchema } } },
    400: errorResponse("Not a PNG, JPEG or WebP image"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an owner or admin of this organization"),
    404: errorResponse("No such organization"),
    413: errorResponse("File too large"),
  },
});

export const organizations = new OpenAPIHono<{ Variables: AuthVariables }>()
  .openapi(listTypes, async (c) => {
    const { data, error } = await c.var.supabase
      .from("organization_types")
      .select("id, name, is_preset")
      .order("is_preset", { ascending: false })
      .order("name");

    if (error) throw databaseError(error);
    return c.json({ data: data.map((t) => ({ id: t.id, name: t.name, isPreset: t.is_preset })) }, 200);
  })
  .openapi(listOrganizations, async (c) => {
    const { data, error } = await c.var.supabase
      .from("organization_members")
      .select(`role, organization:organizations(${ORGANIZATION_COLUMNS})`)
      .eq("user_id", c.var.userId)
      .order("created_at", { ascending: false })
      .overrideTypes<{ role: OrganizationRole; organization: OrganizationRow }[], { merge: false }>();

    if (error) throw databaseError(error);
    return c.json({ data: data.map((m) => toOrganization(m.organization, m.role)) }, 200);
  })
  .openapi(getOrganization, async (c) => {
    const { id } = c.req.valid("param");
    const organization = await findOrganization(c.var.supabase, c.var.userId, id);
    if (!organization) throw new ApiException(404, "not_found", "No such organization.");
    return c.json(organization, 200);
  })
  .openapi(createOrganization, async (c) => {
    const input = c.req.valid("json");

    const { data, error } = await c.var.supabase
      .rpc("create_organization", {
        org_name: input.name,
        org_type: input.type,
        org_description: input.description ?? null,
        org_zipcode: input.zipcode ?? null,
        org_address: input.address ?? null,
        org_discord_url: input.discordUrl ?? null,
        org_website_url: input.websiteUrl ?? null,
        org_instagram_url: input.instagramUrl ?? null,
      })
      .single<{ id: string }>();

    if (error) throw databaseError(error);

    const organization = await findOrganization(c.var.supabase, c.var.userId, data.id);
    if (!organization) throw new ApiException(502, "database_error", "Created the organization but couldn't read it back.");
    return c.json(organization, 201);
  })
  .openapi(uploadLogo, async (c) => {
    const { id } = c.req.valid("param");
    const { file } = c.req.valid("form");

    const { bytes, contentType, extension } = await readLogoUpload(file);

    const existing = await findManageableOrganization(c.var.supabase, c.var.userId, id);

    // A new file name each time, so browsers and CDNs never show a stale logo.
    const path = `${id}/logo-${Date.now()}.${extension}`;
    const storage = c.var.supabase.storage.from(LOGO_BUCKET);
    const upload = await storage.upload(path, bytes, { contentType, upsert: false });
    if (upload.error) {
      console.error(upload.error);
      throw new ApiException(502, "storage_error", "Couldn't store the logo.");
    }

    const { data: oldPath, error } = await c.var.supabase.rpc("set_organization_logo", {
      org_id: id,
      new_logo_path: path,
    });
    if (error) {
      await storage.remove([path]);
      throw databaseError(error);
    }
    if (typeof oldPath === "string" && oldPath !== path) await storage.remove([oldPath]);

    return c.json({ ...existing, logoUrl: publicLogoUrl(path) }, 200);
  })
  .openapi(updateOrganization, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const existing = await findManageableOrganization(c.var.supabase, c.var.userId, id);

    // Fields left out keep their current value; null clears them.
    const pick = <K extends keyof typeof input & keyof Organization>(key: K) =>
      input[key] === undefined ? existing[key] : input[key];

    const { error } = await c.var.supabase.rpc("update_organization", {
      org_id: id,
      org_name: pick("name"),
      org_type: pick("type"),
      org_description: pick("description"),
      org_zipcode: pick("zipcode"),
      org_address: pick("address"),
      org_discord_url: pick("discordUrl"),
      org_website_url: pick("websiteUrl"),
      org_instagram_url: pick("instagramUrl"),
    });
    if (error) throw databaseError(error);

    const updated = await findOrganization(c.var.supabase, c.var.userId, id);
    if (!updated) throw new ApiException(404, "not_found", "No such organization.");
    return c.json(updated, 200);
  })
  .openapi(removeLogo, async (c) => {
    const { id } = c.req.valid("param");
    const existing = await findManageableOrganization(c.var.supabase, c.var.userId, id);

    const { data: oldPath, error } = await c.var.supabase.rpc("set_organization_logo", {
      org_id: id,
      new_logo_path: null,
    });
    if (error) throw databaseError(error);
    if (typeof oldPath === "string") await c.var.supabase.storage.from(LOGO_BUCKET).remove([oldPath]);

    return c.json({ ...existing, logoUrl: null }, 200);
  });
