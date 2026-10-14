import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  ApiErrorSchema,
  CreateOrganizationSchema,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  OrganizationListSchema,
  OrganizationSchema,
  OrganizationTypeListSchema,
  UpdateOrganizationSchema,
  type Organization,
  type OrganizationRole,
} from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException } from "../lib/errors";
import type { UserClient } from "../lib/supabase";
import { env } from "../env";

const LOGO_BUCKET = "organization-logos";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  zipcode: string | null;
  address: string | null;
  discord_url: string | null;
  website_url: string | null;
  logo_path: string | null;
  created_at: string;
  type: { name: string } | null;
};

const ORGANIZATION_COLUMNS =
  "id, name, slug, description, zipcode, address, discord_url, website_url, logo_path, created_at, type:organization_types(name)";

const logoUrl = (path: string | null) =>
  path ? `${env.SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}` : null;

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
  logoUrl: logoUrl(row.logo_path),
  role,
  createdAt: row.created_at,
});

function databaseError(error: PostgrestError): ApiException {
  // Missing table or function: a database migration hasn't been applied.
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code)) {
    return new ApiException(503, "not_set_up", "Organizations aren't fully set up in the database yet.");
  }
  if (error.code === "42501") return new ApiException(403, "forbidden", "You can't change this organization.");
  if (error.code === "22023" || error.code === "23514") {
    return new ApiException(400, "invalid_request", error.message);
  }
  console.error(error);
  return new ApiException(502, "database_error", "The database couldn't complete the request.");
}

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

// Checks the file's first bytes really are a PNG, JPEG or WebP image.
function sniffImageType(bytes: Uint8Array): (typeof LOGO_TYPES)[number] | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

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
  description: `A PNG, JPEG or WebP image of up to ${LOGO_MAX_BYTES / 1024 / 1024} MB, sent as multipart/form-data in a field named \`file\`.`,
  security: [{ Bearer: [] }],
  middleware: [
    requireUser,
    bodyLimit({
      maxSize: LOGO_MAX_BYTES + 64 * 1024,
      onError: () => {
        throw new ApiException(413, "file_too_large", "Logos can be up to 2 MB.");
      },
    }),
  ] as const,
  request: {
    params: IdParams,
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.any().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
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

    if (!(file instanceof File)) {
      throw new ApiException(400, "invalid_request", "Send the image in a form field named \"file\".");
    }
    if (file.size > LOGO_MAX_BYTES) throw new ApiException(413, "file_too_large", "Logos can be up to 2 MB.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = sniffImageType(bytes);
    if (!contentType) throw new ApiException(400, "invalid_image", "Logos must be PNG, JPEG or WebP images.");

    const existing = await findManageableOrganization(c.var.supabase, c.var.userId, id);

    // A new file name each time, so browsers and CDNs never show a stale logo.
    const path = `${id}/logo-${Date.now()}.${EXTENSIONS[contentType]}`;
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

    return c.json({ ...existing, logoUrl: logoUrl(path) }, 200);
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
