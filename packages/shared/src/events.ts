import { z } from "zod";
import { DISCORD_INVITE_PATTERN, ZIPCODE_PATTERN } from "./schemas";

// Events, run by an organization.

export const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// 24-hour "HH:mm", e.g. "09:00" or "21:30".
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Reads a time of day as people type it: "9", "9am", "9:30 pm", "21:30",
 * "9.30", "noon", "midnight". Returns 24-hour "HH:mm", or null if it isn't a
 * time.
 */
export function parseTimeOfDay(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (t === "noon") return "12:00";
  if (t === "midnight") return "00:00";

  const m = t.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.[0];
  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "a" && hours === 12) hours = 0;
    if (meridiem === "p" && hours !== 12) hours += 12;
  } else if (hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Local wall-clock bounds, comparable as strings within one time zone.
export const localStart = (date: string, time?: string) => `${date}T${time ?? "00:00"}:00`;
export const localEnd = (date: string, time?: string) => (time ? `${date}T${time}:00` : `${date}T23:59:59`);

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const EVENT_VISIBILITIES = ["public", "private", "hidden"] as const;

export const EventVisibilitySchema = z.enum(EVENT_VISIBILITIES).meta({
  id: "EventVisibility",
  description:
    "public: the organization's members can see it and sign up. private: members can see it; sign-up is by invitation. hidden: only organizers (owners and admins) can see it.",
});

export const EventTypeSchema = z
  .object({
    id: z.number().int(),
    name: z.string().meta({ example: "Tournament" }),
    isPreset: z.boolean().meta({ description: "Part of Droplet's starter list, rather than added by a user." }),
  })
  .meta({ id: "EventType" });

export const EventTypeListSchema = z.object({ data: z.array(EventTypeSchema) }).meta({ id: "EventTypeList" });

export const EventSchema = z
  .object({
    id: z.uuid(),
    organizationId: z.uuid(),
    organizationName: z.string().meta({ example: "Northfield Esports Club" }),
    organizationSlug: z.string().meta({ example: "northfield-esports-club" }),
    name: z.string().meta({ example: "Autumn Invitational" }),
    type: z.string().meta({ example: "Tournament" }),
    startsAt: z.iso.datetime({ offset: true }).meta({
      description: "When it starts (an exact moment). Without a start time, the start of its first day.",
    }),
    endsAt: z.iso.datetime({ offset: true }).meta({
      description: "When it ends. Without an end time, the end of its last day.",
    }),
    hasStartTime: z.boolean().meta({ description: "False when only a start date was given." }),
    hasEndTime: z.boolean().meta({ description: "False when only an end date was given." }),
    visibility: EventVisibilitySchema,
    timezone: z.string().meta({ description: "IANA time zone the event happens in.", example: "America/Chicago" }),
    address: z.string().nullable().meta({ example: "Cedar Hall, 1200 Cedar Ave" }),
    city: z.string().nullable().meta({ example: "Riverton" }),
    postalCode: z.string().nullable().meta({ example: "60201" }),
    country: z.string().nullable().meta({ description: "ISO 3166-1 alpha-2 code.", example: "US" }),
    capacity: z.number().int().nullable().meta({ example: 64 }),
    discordUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    canManage: z.boolean().meta({ description: "Whether the signed-in user is an owner or admin of the organization." }),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Event" });

export const EventListSchema = z.object({ data: z.array(EventSchema) }).meta({ id: "EventList" });

export const CreateEventSchema = z
  .object({
    name: z.string().trim().min(2).max(120).meta({ example: "Autumn Invitational" }),
    type: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .meta({ description: "A type from GET /v1/event-types, or a new custom type.", example: "Tournament" }),
    startDate: z.string().regex(DATE_PATTERN, "Enter a start date.").meta({ example: "2026-10-03" }),
    startTime: z
      .string()
      .regex(TIME_PATTERN, "Enter a time like 9:00 AM.")
      .optional()
      .meta({ description: "24-hour local time in `timezone`. Leave out for a date-only start.", example: "09:00" }),
    endDate: z.string().regex(DATE_PATTERN, "Enter an end date.").meta({ example: "2026-10-05" }),
    endTime: z
      .string()
      .regex(TIME_PATTERN, "Enter a time like 6:00 PM.")
      .optional()
      .meta({ description: "24-hour local time in `timezone`. Leave out for a date-only end.", example: "18:00" }),
    visibility: EventVisibilitySchema.default("public"),
    timezone: z
      .string()
      .refine(isValidTimeZone, "Choose a valid time zone.")
      .meta({ description: "IANA time zone name.", example: "America/Chicago" }),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().regex(POSTAL_CODE_PATTERN, "Enter a valid postal code.").optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/, "Choose a country.")
      .optional()
      .meta({ description: "ISO 3166-1 alpha-2 code.", example: "US" }),
    capacity: z.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1.").max(1_000_000).optional(),
    discordUrl: z
      .string()
      .trim()
      .regex(DISCORD_INVITE_PATTERN, "Enter a Discord invite link, like https://discord.gg/abc123.")
      .optional(),
    websiteUrl: z.httpUrl("Enter a full web address, starting with https://.").max(300).optional(),
  })
  .superRefine((e, ctx) => {
    // Local times in the same zone compare correctly as strings.
    if (
      DATE_PATTERN.test(e.startDate) &&
      DATE_PATTERN.test(e.endDate) &&
      localEnd(e.endDate, e.endTime) <= localStart(e.startDate, e.startTime)
    ) {
      const path = e.endDate < e.startDate ? ["endDate"] : ["endTime"];
      ctx.addIssue({ code: "custom", path, message: "The event must end after it starts." });
    }
    if (e.country === "US" && e.postalCode && !ZIPCODE_PATTERN.test(e.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Enter a 5-digit ZIP code, like 60201." });
    }
  })
  .meta({ id: "CreateEvent" });

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventTypeList = z.infer<typeof EventTypeListSchema>;
export type DropletEvent = z.infer<typeof EventSchema>;
export type EventList = z.infer<typeof EventListSchema>;
export type EventVisibility = z.infer<typeof EventVisibilitySchema>;
export type CreateEvent = z.input<typeof CreateEventSchema>;
