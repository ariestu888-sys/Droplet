import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CreateEventSchema,
  EventListSchema,
  EventSchema,
  EventTypeListSchema,
  type DropletEvent,
  type EventVisibility,
  type OrganizationRole,
} from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException, databaseError } from "../lib/errors";
import type { UserClient } from "../lib/supabase";

type CreateEventInput = z.output<typeof CreateEventSchema>;

type EventRow = {
  id: string;
  organization_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  has_start_time: boolean;
  has_end_time: boolean;
  visibility: EventVisibility;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  capacity: number | null;
  discord_url: string | null;
  website_url: string | null;
  created_at: string;
  type: { name: string } | null;
  organization: { name: string; slug: string } | null;
};

const EVENT_COLUMNS =
  "id, organization_id, name, starts_at, ends_at, timezone, has_start_time, has_end_time, visibility, address, city, postal_code, country, capacity, discord_url, website_url, created_at, type:event_types(name), organization:organizations(name, slug)";

const toEvent = (row: EventRow, role: OrganizationRole): DropletEvent => ({
  id: row.id,
  organizationId: row.organization_id,
  organizationName: row.organization?.name ?? "",
  organizationSlug: row.organization?.slug ?? "",
  name: row.name,
  type: row.type?.name ?? "Other",
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  timezone: row.timezone,
  hasStartTime: row.has_start_time,
  hasEndTime: row.has_end_time,
  visibility: row.visibility,
  address: row.address,
  city: row.city,
  postalCode: row.postal_code,
  country: row.country,
  capacity: row.capacity,
  discordUrl: row.discord_url,
  websiteUrl: row.website_url,
  canManage: role === "owner" || role === "admin",
  createdAt: row.created_at,
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

// API fields -> parameters of the create_event/update_event database functions.
const eventParams = (input: CreateEventInput) => ({
  event_name: input.name,
  event_type: input.type,
  event_start_date: input.startDate,
  event_end_date: input.endDate,
  event_timezone: input.timezone,
  event_visibility: input.visibility,
  event_start_time: input.startTime ?? null,
  event_end_time: input.endTime ?? null,
  event_address: input.address ?? null,
  event_city: input.city ?? null,
  event_postal_code: input.postalCode ?? null,
  event_country: input.country ?? null,
  event_capacity: input.capacity ?? null,
  event_discord_url: input.discordUrl ?? null,
  event_website_url: input.websiteUrl ?? null,
});

async function findEvent(supabase: UserClient, userId: string, id: string) {
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle<EventRow>();
  if (error) throw databaseError(error);
  if (!data) return null;
  const role = await roleIn(supabase, userId, data.organization_id);
  return role ? toEvent(data, role) : null;
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

const uuidParam = (name: string) =>
  z.uuid().openapi({ param: { name, in: "path" }, example: "7d3f2c1e-5b8a-4f6e-9c2d-1a0b3e4f5a6b" });

const listTypes = createRoute({
  method: "get",
  path: "/event-types",
  tags: ["Events"],
  summary: "List event types: Droplet's starter list plus custom types people have added",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  responses: {
    200: { description: "Starter types first, then custom ones, A–Z", content: { "application/json": { schema: EventTypeListSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const listForOrganization = createRoute({
  method: "get",
  path: "/organizations/{id}/events",
  tags: ["Events"],
  summary: "List an organization's events (members; hidden events only for owners and admins)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "Soonest first", content: { "application/json": { schema: EventListSchema } } },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such organization, or the user isn't a member"),
  },
});

const createEvent = createRoute({
  method: "post",
  path: "/organizations/{id}/events",
  tags: ["Events"],
  summary: "Create an event for an organization (owners and admins)",
  description:
    "Dates and times are local to `timezone`. Times are optional: without a start time the event starts at the beginning of `startDate`, and without an end time it runs to the end of `endDate`. A `type` that doesn't exist yet is added as a custom type.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id") }),
    body: { required: true, content: { "application/json": { schema: CreateEventSchema } } },
  },
  responses: {
    201: { description: "The new event", content: { "application/json": { schema: EventSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an owner or admin of this organization"),
    404: errorResponse("No such organization"),
  },
});

const getEvent = createRoute({
  method: "get",
  path: "/events/{id}",
  tags: ["Events"],
  summary: "Get one event (members of its organization)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    200: { description: "The event", content: { "application/json": { schema: EventSchema } } },
    401: errorResponse("Not signed in"),
    404: errorResponse("No such event, or the user isn't a member of its organization"),
  },
});

const updateEvent = createRoute({
  method: "put",
  path: "/events/{id}",
  tags: ["Events"],
  summary: "Replace an event's details (organizers: owners and admins)",
  description:
    "Send the event's full details, as when creating it; optional fields left out are cleared. Use this to change visibility too, e.g. to release a hidden event.",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    params: z.object({ id: uuidParam("id") }),
    body: { required: true, content: { "application/json": { schema: CreateEventSchema } } },
  },
  responses: {
    200: { description: "The updated event", content: { "application/json": { schema: EventSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer of this event's organization"),
    404: errorResponse("No such event"),
  },
});

const deleteEvent = createRoute({
  method: "delete",
  path: "/events/{id}",
  tags: ["Events"],
  summary: "Delete an event permanently (organizers: owners and admins)",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: { params: z.object({ id: uuidParam("id") }) },
  responses: {
    204: { description: "Deleted" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not an organizer of this event's organization"),
    404: errorResponse("No such event"),
  },
});

// Loads an event the signed-in user can manage, or throws 404/403.
async function findManageableEvent(supabase: UserClient, userId: string, id: string) {
  const event = await findEvent(supabase, userId, id);
  if (!event) throw new ApiException(404, "not_found", "No such event.");
  if (!event.canManage) throw new ApiException(403, "forbidden", "Only organizers can change this event.");
  return event;
}

export const events = new OpenAPIHono<{ Variables: AuthVariables }>()
  .openapi(listTypes, async (c) => {
    const { data, error } = await c.var.supabase
      .from("event_types")
      .select("id, name, is_preset")
      .order("is_preset", { ascending: false })
      .order("name");
    if (error) throw databaseError(error);
    return c.json({ data: data.map((t) => ({ id: t.id, name: t.name, isPreset: t.is_preset })) }, 200);
  })
  .openapi(listForOrganization, async (c) => {
    const { id } = c.req.valid("param");
    const role = await roleIn(c.var.supabase, c.var.userId, id);
    if (!role) throw new ApiException(404, "not_found", "No such organization.");

    const { data, error } = await c.var.supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("organization_id", id)
      .order("starts_at")
      .overrideTypes<EventRow[], { merge: false }>();
    if (error) throw databaseError(error);
    return c.json({ data: data.map((row) => toEvent(row, role)) }, 200);
  })
  .openapi(createEvent, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const role = await roleIn(c.var.supabase, c.var.userId, id);
    if (!role) throw new ApiException(404, "not_found", "No such organization.");
    if (role === "member") throw new ApiException(403, "forbidden", "Only owners and admins can create events.");

    const { data, error } = await c.var.supabase
      .rpc("create_event", { org_id: id, ...eventParams(input) })
      .single<{ id: string }>();
    if (error) throw databaseError(error);

    const event = await findEvent(c.var.supabase, c.var.userId, data.id);
    if (!event) throw new ApiException(502, "database_error", "Created the event but couldn't read it back.");
    return c.json(event, 201);
  })
  .openapi(getEvent, async (c) => {
    const { id } = c.req.valid("param");
    const event = await findEvent(c.var.supabase, c.var.userId, id);
    if (!event) throw new ApiException(404, "not_found", "No such event.");
    return c.json(event, 200);
  })
  .openapi(updateEvent, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    await findManageableEvent(c.var.supabase, c.var.userId, id);

    const { error } = await c.var.supabase.rpc("update_event", { target_event_id: id, ...eventParams(input) });
    if (error) throw databaseError(error);

    const event = await findEvent(c.var.supabase, c.var.userId, id);
    if (!event) throw new ApiException(404, "not_found", "No such event.");
    return c.json(event, 200);
  })
  .openapi(deleteEvent, async (c) => {
    const { id } = c.req.valid("param");
    await findManageableEvent(c.var.supabase, c.var.userId, id);

    const { error } = await c.var.supabase.rpc("delete_event", { target_event_id: id });
    if (error) throw databaseError(error);
    return c.body(null, 204);
  });
