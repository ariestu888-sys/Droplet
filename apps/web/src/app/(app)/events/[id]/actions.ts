"use server";

import { redirect } from "next/navigation";
import { DropletApiError } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";
import { parseEventForm, type EventFormState } from "@/lib/event-form";

function describeError(err: unknown, action: string) {
  if (err instanceof DropletApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403) return "Only organizers can change this event.";
    if (err.status === 404) return "This event no longer exists.";
    if (err.code === "not_set_up") {
      return "Editing events isn't set up in the database yet. Run the latest migration in supabase/migrations.";
    }
    if (err.status === 400) return err.message;
  }
  return `Couldn't ${action}. Please try again.`;
}

// Bound to the event's id by the edit page.
export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const form = parseEventForm(formData);
  if (!form.ok || !form.input) {
    return { error: "Please fix the highlighted fields.", fieldErrors: form.fieldErrors, values: form.values };
  }

  try {
    const api = await createServerApi();
    await api.events.update(eventId, form.input);
  } catch (err) {
    return { error: describeError(err, "save your changes"), values: form.values };
  }

  redirect(`/events/${eventId}`);
}

export type DeleteEventState = { error?: string };

// Bound to the event's and its organization's ids by the delete button.
export async function deleteEvent(eventId: string, organizationId: string): Promise<DeleteEventState> {
  try {
    const api = await createServerApi();
    await api.events.delete(eventId);
  } catch (err) {
    return { error: describeError(err, "delete the event") };
  }

  redirect(`/organizations/${organizationId}`);
}
