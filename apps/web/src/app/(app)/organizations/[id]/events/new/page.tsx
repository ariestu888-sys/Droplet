import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, isOrganizer, type EventType, type Organization } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { EventForm } from "@/components/events/event-form";
import { createServerApi } from "@/lib/api/server";
import { COUNTRIES } from "@/lib/countries";
import { isUuid } from "@/lib/uuid";
import { createEvent } from "./actions";

export const metadata: Metadata = { title: "Create event · Droplet" };

export default function NewEventPage({ params }: PageProps<"/organizations/[id]/events/new">) {
  return (
    <div className="max-w-[720px]">
      <Suspense fallback={<p className="text-sm text-subtle">Loading…</p>}>
        <NewEventForm params={params} />
      </Suspense>
    </div>
  );
}

async function NewEventForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: the Supabase client reads the clock while checking the session.
  await connection();
  if (!isUuid(id)) notFound();

  const api = await createServerApi();
  let org: Organization;
  let types: EventType[];
  try {
    [org, { data: types }] = await Promise.all([api.organizations.get(id), api.eventTypes.list()]);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {notSetUp
          ? "Events aren't set up in the database yet. Run the latest migration in supabase/migrations."
          : "Couldn't load this form. Is the Droplet API running?"}
      </p>
    );
  }

  const back = (
    <Link href={`/organizations/${org.id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
      <span aria-hidden>←</span> {org.name}
    </Link>
  );

  if (!isOrganizer(org.role)) {
    return (
      <>
        {back}
        <PageHeader title="Create event" />
        <p className="dr-card text-sm text-body">Only owners and admins can create events for {org.name}.</p>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader title="Create event" subtitle={`A new event run by ${org.name}.`} />
      <div className="dr-card">
        <EventForm
          action={createEvent.bind(null, org.id)}
          types={types}
          countries={COUNTRIES}
          timeZones={Intl.supportedValuesOf("timeZone")}
          submitLabel="Create event"
          pendingLabel="Creating…"
          cancelHref={`/organizations/${org.id}`}
        />
      </div>
    </>
  );
}
