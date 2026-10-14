import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, type DropletEvent, type EventType } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { EventForm } from "@/components/events/event-form";
import { createServerApi } from "@/lib/api/server";
import { COUNTRIES } from "@/lib/countries";
import { eventToFormValues } from "@/lib/event-form";
import { isUuid } from "@/lib/uuid";
import { updateEvent } from "../actions";
import { DeleteEventButton } from "../delete-event-button";

export const metadata: Metadata = { title: "Edit event · Droplet" };

export default function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  return (
    <div className="max-w-[720px]">
      <Suspense fallback={<p className="text-sm text-subtle">Loading…</p>}>
        <EditEventForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditEventForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: the Supabase client reads the clock while checking the session.
  await connection();
  if (!isUuid(id)) notFound();

  const api = await createServerApi();
  let event: DropletEvent;
  let types: EventType[];
  try {
    [event, { data: types }] = await Promise.all([api.events.get(id), api.eventTypes.list()]);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        Couldn&apos;t load this event. Is the Droplet API running?
      </p>
    );
  }

  const back = (
    <Link href={`/events/${event.id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
      <span aria-hidden>←</span> {event.name}
    </Link>
  );

  if (!event.canManage) {
    return (
      <>
        {back}
        <PageHeader title="Edit event" />
        <p className="dr-card text-sm text-body">Only organizers of {event.organizationName} can edit this event.</p>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader title="Edit event" subtitle={`Update ${event.name}. Changes show up right away.`} />
      <div className="dr-card">
        <EventForm
          action={updateEvent.bind(null, event.id)}
          initial={eventToFormValues(event)}
          types={types}
          countries={COUNTRIES}
          timeZones={Intl.supportedValuesOf("timeZone")}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref={`/events/${event.id}`}
        />
      </div>

      <section aria-labelledby="delete-heading" className="dr-card mt-4 flex flex-wrap items-center justify-between gap-4 border-coral-tint">
        <div>
          <h2 id="delete-heading" className="text-base font-bold">Delete this event</h2>
          <p className="text-sm text-muted">This removes it for everyone and can&apos;t be undone.</p>
        </div>
        <DeleteEventButton eventId={event.id} organizationId={event.organizationId} eventName={event.name} />
      </section>
    </>
  );
}
