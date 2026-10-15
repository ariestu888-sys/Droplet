import { z } from "zod";

// Public splash pages and organization sponsors.

export const SPLASH_HTML_MAX_LENGTH = 100_000;

// "#1a2b3c": six-digit hex, lower case.
export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HEX_COLOR_PATTERN, "Use a six-digit hex color, like #0ea5e9.");

export const SplashColorsSchema = z
  .object({
    primaryColor: hexColor.nullable().meta({
      description: "Buttons, links, badges and the header tint. Null for Droplet's default.",
      example: "#0ea5e9",
    }),
    secondaryColor: hexColor.nullable().meta({
      description: "Accents and decoration. Null for Droplet's default.",
      example: "#ff6b57",
    }),
  })
  .meta({ id: "SplashColors" });

export const SponsorSchema = z
  .object({
    id: z.uuid(),
    name: z.string().meta({ example: "Riverton Pizza Co." }),
    websiteUrl: z.string().nullable().meta({ example: "https://rivertonpizza.example" }),
    logoUrl: z.string().nullable().meta({ description: "Public URL of the sponsor's logo." }),
  })
  .meta({ id: "Sponsor" });

export const SponsorListSchema = z.object({ data: z.array(SponsorSchema) }).meta({ id: "SponsorList" });

export const CreateSponsorSchema = z
  .object({
    name: z.string().trim().min(1).max(100).meta({ example: "Riverton Pizza Co." }),
    websiteUrl: z.httpUrl("Enter a full web address, starting with https://.").max(300).optional(),
  })
  .meta({ id: "CreateSponsor" });

export const SplashEventSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.string(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    timezone: z.string(),
    hasStartTime: z.boolean(),
    hasEndTime: z.boolean(),
    city: z.string().nullable(),
    country: z.string().nullable(),
  })
  .meta({ id: "SplashEvent" });

export const SplashPageSchema = z
  .object({
    organization: z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      type: z.string(),
      description: z.string().nullable(),
      address: z.string().nullable(),
      zipcode: z.string().nullable(),
      websiteUrl: z.string().nullable(),
      discordUrl: z.string().nullable(),
      instagramUrl: z.string().nullable(),
      logoUrl: z.string().nullable(),
      primaryColor: z.string().nullable(),
      secondaryColor: z.string().nullable(),
    }),
    html: z.string().nullable().meta({ description: "The organization's splash content, already sanitized." }),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    upcomingEvents: z
      .array(SplashEventSchema)
      .meta({ description: "Upcoming public events, soonest first. Private and hidden events are never included." }),
    sponsors: z.array(SponsorSchema),
  })
  .meta({ id: "SplashPage" });

export const EventSplashPageSchema = z
  .object({
    organization: z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      logoUrl: z.string().nullable(),
      primaryColor: z.string().nullable(),
      secondaryColor: z.string().nullable(),
    }),
    event: z.object({
      id: z.uuid(),
      name: z.string(),
      type: z.string(),
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
      timezone: z.string(),
      hasStartTime: z.boolean(),
      hasEndTime: z.boolean(),
      address: z.string().nullable(),
      city: z.string().nullable(),
      postalCode: z.string().nullable(),
      country: z.string().nullable(),
      capacity: z.number().int().nullable(),
      websiteUrl: z.string().nullable(),
      discordUrl: z.string().nullable(),
    }),
    html: z.string().nullable().meta({ description: "The event's splash content, already sanitized." }),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    sponsors: z.array(SponsorSchema).meta({ description: "The organization's sponsors." }),
  })
  .meta({ id: "EventSplashPage" });

export const SplashContentSchema = z
  .object({
    html: z.string().nullable(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    removedUnsafeContent: z
      .boolean()
      .optional()
      .meta({ description: "After a save: whether unsafe markup (scripts, event handlers, forms…) was removed." }),
  })
  .meta({ id: "SplashContent" });

export const UpdateSplashSchema = z
  .object({
    html: z
      .string()
      .max(SPLASH_HTML_MAX_LENGTH)
      .meta({ description: "HTML for the splash page. Unsafe markup (scripts, event handlers, forms) is removed when saved." }),
  })
  .meta({ id: "UpdateSplash" });

export type Sponsor = z.infer<typeof SponsorSchema>;
export type SponsorList = z.infer<typeof SponsorListSchema>;
export type CreateSponsor = z.infer<typeof CreateSponsorSchema>;
export type SplashEvent = z.infer<typeof SplashEventSchema>;
export type SplashPage = z.infer<typeof SplashPageSchema>;
export type SplashContent = z.infer<typeof SplashContentSchema>;
export type UpdateSplash = z.infer<typeof UpdateSplashSchema>;
export type EventSplashPage = z.infer<typeof EventSplashPageSchema>;
export type SplashColors = z.infer<typeof SplashColorsSchema>;
