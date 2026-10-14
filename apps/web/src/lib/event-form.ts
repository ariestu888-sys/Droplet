import { CreateEventSchema, parseTimeOfDay, type CreateEvent, type DropletEvent } from "@droplet/shared";
import { CUSTOM_TYPE } from "./form-constants";

// Reads and checks the event form, for the server action.

type FieldName = keyof CreateEvent;

export type EventFormValues = Partial<Record<FieldName | "customType", string>>;

export type EventFormState = {
  error?: string;
  fieldErrors?: Partial<Record<FieldName, string>>;
  // What the user typed, so the form can show it again after an error.
  values?: EventFormValues;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

const FRIENDLY_ERRORS: Partial<Record<FieldName, string>> = {
  name: "Names need 2 to 120 characters.",
  type: "Pick a type, or enter your own (2 to 40 characters).",
  address: "Addresses can be up to 200 characters.",
  city: "City names can be up to 100 characters.",
  visibility: "Choose who can see this event.",
};

// An existing event as form values, with dates and times in its own time zone.
export function eventToFormValues(event: DropletEvent): EventFormValues {
  const local = (iso: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: event.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(new Date(iso));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`,
    };
  };
  const start = local(event.startsAt);
  const end = local(event.endsAt);

  return {
    name: event.name,
    type: event.type,
    startDate: start.date,
    startTime: event.hasStartTime ? start.time : "",
    endDate: end.date,
    endTime: event.hasEndTime ? end.time : "",
    timezone: event.timezone,
    visibility: event.visibility,
    address: event.address ?? "",
    city: event.city ?? "",
    postalCode: event.postalCode ?? "",
    country: event.country ?? "",
    capacity: event.capacity?.toString() ?? "",
    discordUrl: event.discordUrl ?? "",
    websiteUrl: event.websiteUrl ?? "",
  };
}

export function parseEventForm(formData: FormData) {
  const values: EventFormValues = {
    name: text(formData, "name"),
    type: text(formData, "type"),
    customType: text(formData, "customType"),
    startDate: text(formData, "startDate"),
    startTime: text(formData, "startTime"),
    endDate: text(formData, "endDate"),
    endTime: text(formData, "endTime"),
    timezone: text(formData, "timezone"),
    visibility: text(formData, "visibility"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    postalCode: text(formData, "postalCode"),
    country: text(formData, "country"),
    capacity: text(formData, "capacity"),
    discordUrl: text(formData, "discordUrl"),
    websiteUrl: text(formData, "websiteUrl"),
  };

  const capacity = values.capacity ? Number(values.capacity) : undefined;
  // Times are typed freely ("9am", "21:30"); blank means date only.
  const startTime = values.startTime ? (parseTimeOfDay(values.startTime) ?? values.startTime) : undefined;
  const endTime = values.endTime ? (parseTimeOfDay(values.endTime) ?? values.endTime) : undefined;
  const parsed = CreateEventSchema.safeParse({
    name: values.name,
    type: values.type === CUSTOM_TYPE ? values.customType : values.type,
    startDate: values.startDate,
    startTime,
    endDate: values.endDate,
    endTime,
    timezone: values.timezone,
    visibility: values.visibility,
    // Blank optional fields are left out.
    address: values.address || undefined,
    city: values.city || undefined,
    postalCode: values.postalCode || undefined,
    country: values.country || undefined,
    capacity: Number.isNaN(capacity) ? values.capacity : capacity,
    discordUrl: values.discordUrl || undefined,
    websiteUrl: values.websiteUrl || undefined,
  });

  const fieldErrors: NonNullable<EventFormState["fieldErrors"]> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as FieldName;
      fieldErrors[key] ??= FRIENDLY_ERRORS[key] ?? (key === "capacity" && issue.code === "invalid_type" ? "Capacity must be a number." : issue.message);
    }
  }

  return { ok: parsed.success, input: parsed.success ? parsed.data : null, values, fieldErrors };
}
