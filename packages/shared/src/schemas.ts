import { z } from "zod";

// The shapes of the Droplet API's requests and responses. The API validates
// against these and publishes them in its OpenAPI docs; clients (the website,
// the mobile app) use the inferred types. `.meta({ id })` names each one in
// the docs.

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: "unauthorized" }),
      message: z.string().meta({ example: "Missing or invalid access token." }),
    }),
  })
  .meta({ id: "ApiError" });

export const HealthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    version: z.string().meta({ example: "0.1.0" }),
    services: z.object({
      supabase: z.enum(["up", "down"]),
    }),
  })
  .meta({ id: "Health" });

export const ProfileSchema = z
  .object({
    id: z.uuid(),
    email: z.email().nullable(),
    fullName: z.string().nullable().meta({ example: "Jamie Rivera" }),
    avatarUrl: z.url().nullable(),
    provider: z.string().meta({ description: "How the user signs in.", example: "google" }),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Profile" });

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).meta({ example: "Jamie Rivera" }),
  })
  .meta({ id: "UpdateProfile" });

// Roles in an organization, most to least access. Owners and admins are
// "organizers". Keep in step with the database (supabase/migrations).
export const ORGANIZATION_ROLES = ["owner", "admin", "booster", "member", "subscriber"] as const;

export const OrganizationRoleSchema = z.enum(ORGANIZATION_ROLES).meta({
  id: "OrganizationRole",
  description:
    "owner: overall ownership. admin: edits pages and events, manages members below admin. booster: volunteer helper. member: takes part, sees public and private events. subscriber: follows updates, sees public events.",
});

export type OrganizationRoleName = (typeof ORGANIZATION_ROLES)[number];

export const ROLE_LABELS: Record<OrganizationRoleName, string> = {
  owner: "Owner",
  admin: "Admin",
  booster: "Booster",
  member: "Member",
  subscriber: "Subscriber",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRoleName, string> = {
  owner: "Overall ownership of the organization",
  admin: "Edits the organization's pages and events, and manages members",
  booster: "A volunteer helper for the organization",
  member: "Takes part in activities and gets updates",
  subscriber: "Follows the organization's updates",
};

/** Owners and admins: can edit the organization's pages and events. */
export const isOrganizer = (role: OrganizationRoleName | null | undefined) => role === "owner" || role === "admin";

/** Whether someone with `actor` may give or take away `target` (matches the database's can_manage_role). */
export function canManageRole(actor: OrganizationRoleName | null | undefined, target: OrganizationRoleName) {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  if (actor === "admin") return target === "booster" || target === "member" || target === "subscriber";
  return false;
}

/** Roles someone with `actor` can assign, most access first. */
export const assignableRoles = (actor: OrganizationRoleName | null | undefined) =>
  ORGANIZATION_ROLES.filter((r) => canManageRole(actor, r));

// Field rules, shared so forms can check input the same way the API does.
export const ZIPCODE_PATTERN = /^\d{5}(-\d{4})?$/;
export const DISCORD_INVITE_PATTERN =
  /^https:\/\/(www\.)?(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[A-Za-z0-9-]+\/?$/i;
// A full Instagram profile link, as stored.
export const INSTAGRAM_URL_PATTERN = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/i;

/**
 * Turns what people type for an Instagram account ("@northfield",
 * "northfield", "instagram.com/northfield", a full link with tracking
 * parameters) into "https://www.instagram.com/northfield/". Returns the
 * input unchanged if it isn't recognizable, so validation can reject it.
 */
export function normalizeInstagramUrl(input: string): string {
  const value = input.trim();
  const handle =
    value.match(/^@?([A-Za-z0-9._]{1,30})$/)?.[1] ??
    value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i)?.[1];
  return handle ? `https://www.instagram.com/${handle}/` : value;
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const OrganizationTypeSchema = z
  .object({
    id: z.number().int(),
    name: z.string().meta({ example: "Esports club" }),
    isPreset: z.boolean().meta({ description: "Part of Droplet's starter list, rather than added by a user." }),
  })
  .meta({ id: "OrganizationType" });

export const OrganizationTypeListSchema = z
  .object({ data: z.array(OrganizationTypeSchema) })
  .meta({ id: "OrganizationTypeList" });

export const OrganizationSchema = z
  .object({
    id: z.uuid(),
    name: z.string().meta({ example: "Northfield Esports Club" }),
    slug: z.string().meta({ description: "URL-friendly name, unique across Droplet.", example: "northfield-esports-club" }),
    type: z.string().meta({ example: "Esports club" }),
    description: z.string().nullable(),
    zipcode: z.string().nullable().meta({ example: "60201" }),
    address: z.string().nullable().meta({ example: "1200 Cedar Ave, Riverton" }),
    discordUrl: z.string().nullable().meta({ example: "https://discord.gg/northfield" }),
    websiteUrl: z.string().nullable().meta({ example: "https://northfieldesports.example" }),
    instagramUrl: z.string().nullable().meta({ example: "https://www.instagram.com/northfieldesports/" }),
    logoUrl: z.string().nullable().meta({ description: "Public URL of the logo image." }),
    splashPrimaryColor: z.string().nullable().meta({ description: "Splash page primary color, or null for the default." }),
    splashSecondaryColor: z.string().nullable().meta({ description: "Splash page secondary color, or null for the default." }),
    role: OrganizationRoleSchema.meta({ description: "The signed-in user's role in this organization." }),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Organization" });

export const OrganizationListSchema = z
  .object({ data: z.array(OrganizationSchema) })
  .meta({ id: "OrganizationList" });

// Rules for each editable organization field, shared by create and update.
const organizationFields = {
  name: z.string().trim().min(2).max(80).meta({ example: "Northfield Esports Club" }),
  type: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .meta({ description: "A type from GET /v1/organization-types, or a new custom type.", example: "Esports club" }),
  description: z.string().trim().max(500).meta({ example: "Weekly tournaments for players of all levels." }),
  zipcode: z.string().trim().regex(ZIPCODE_PATTERN, "Enter a 5-digit ZIP code, like 60201."),
  address: z.string().trim().max(200),
  discordUrl: z
    .string()
    .trim()
    .regex(DISCORD_INVITE_PATTERN, "Enter a Discord invite link, like https://discord.gg/abc123."),
  websiteUrl: z.httpUrl("Enter a full web address, starting with https://.").max(300),
  instagramUrl: z
    .string()
    .trim()
    .regex(INSTAGRAM_URL_PATTERN, "Enter an Instagram link or @handle, like @northfieldesports.")
    .meta({ description: "Full profile link. Use normalizeInstagramUrl to accept @handles.", example: "https://www.instagram.com/northfieldesports/" }),
};

export const CreateOrganizationSchema = z
  .object({
    name: organizationFields.name,
    type: organizationFields.type,
    description: organizationFields.description.optional(),
    zipcode: organizationFields.zipcode.optional(),
    address: organizationFields.address.optional(),
    discordUrl: organizationFields.discordUrl.optional(),
    websiteUrl: organizationFields.websiteUrl.optional(),
    instagramUrl: organizationFields.instagramUrl.optional(),
  })
  .meta({ id: "CreateOrganization" });

// Only the fields sent change. Send null to clear an optional field.
export const UpdateOrganizationSchema = z
  .object({
    name: organizationFields.name.optional(),
    type: organizationFields.type.optional(),
    description: organizationFields.description.nullable().optional(),
    zipcode: organizationFields.zipcode.nullable().optional(),
    address: organizationFields.address.nullable().optional(),
    discordUrl: organizationFields.discordUrl.nullable().optional(),
    websiteUrl: organizationFields.websiteUrl.nullable().optional(),
    instagramUrl: organizationFields.instagramUrl.nullable().optional(),
  })
  .meta({ id: "UpdateOrganization" });

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Health = z.infer<typeof HealthSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type OrganizationList = z.infer<typeof OrganizationListSchema>;
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;
export type OrganizationTypeList = z.infer<typeof OrganizationTypeListSchema>;
