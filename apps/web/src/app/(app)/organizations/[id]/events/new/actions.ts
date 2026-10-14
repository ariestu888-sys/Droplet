"use server";

import { redirect } from "next/navigation";
import { DropletApiError } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";
import { parseEventForm, type EventFormState } from "@/lib/event-form";

// Bound to the organization's id by the page.
export async function createEvent(
  organizationId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const form = parseEventForm(formData);
  if (!form.ok || !form.input) {
    return { error: "Please fix the highlighted fields.", fieldErrors: form.fieldErrors, values: form.values };
  }

  let eventId: string;
  try {
    const api = await createServerApi();
    eventId = (await api.events.create(organizationId, form.input)).id;
  } catch (err) {
    return { error: describeError(err), values: form.values };
  }

  redirect(`/events/${eventId}`);
}

function describeError(err: unknown) {
  if (err instanceof DropletApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403) return "Only owners and admins can create events for this organization.";
    if (err.code === "not_set_up") {
      return "Events aren't set up in the database yet. Run the latest migration in supabase/migrations.";
    }
    if (err.status === 400) return err.message;
  }
  return "Couldn't create the event. Please try again.";
}
