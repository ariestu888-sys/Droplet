import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, type DropletEvent } from "@droplet/shared";
import { VisibilityBadge } from "@/components/events/visibility";
import { CalendarIcon, ChatIcon, GlobeIcon, MapPinIcon, PencilIcon, TicketIcon } from "@/components/icons";
import { createServerApi } from "@/lib/api/server";
import { countryName } from "@/lib/countries";
import { eventDateBadge, eventStatus, formatEventRange } from "@/lib/event-dates";
import { isUuid } from "@/lib/uuid";
import { DeleteEventButton } from "./delete-event-button";

export const metadata: Metadata = { title: "Event · Droplet" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className="max-w-[960px]">
      <Suspense fallback={<p className="text-sm text-subtle">Loading event…</p>}>
        <EventDetails params={params} />
      </Suspense>
    </div>
  );
}

async function EventDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: reads the session, and "happening now" depends on the time.
  await connection();
  if (!isUuid(id)) notFound();

  let event: DropletEvent;
  try {
    event = await (await createServerApi()).events.get(id);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        Couldn&apos;t load this event. Is the Droplet API running?
      </p>
    );
  }

  const badge = eventDateBadge(event.startsAt, event.timezone);
  const status = eventStatus(event.startsAt, event.endsAt);
  const place = [
    event.address,
    [event.city, event.postalCode].filter(Boolean).join(" "),
    event.country ? countryName(event.country) : null,
  ].filter(Boolean);

  return (
    <>
      <Link
        href={`/organizations/${event.organizationId}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <span aria-hidden>←</span> {event.organizationName}
      </Link>

      <header className="mb-7 flex flex-wrap items-center gap-5">
        <div className="flex w-20 shrink-0 flex-col items-center rounded-card bg-droplet-tint py-3 text-droplet">
          <span className="text-xs font-bold tracking-[0.06em]">{badge.month}</span>
          <span className="font-display text-[32px] leading-none font-bold">{badge.day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 text-[28px] leading-tight font-bold tracking-[-0.01em] break-words">{event.name}</h1>
          <div className="flex flex-wrap gap-2">
            <span className="dr-badge bg-droplet-tint text-[#0369a1]">{event.type}</span>
            <VisibilityBadge visibility={event.visibility} />
            {status === "live" && (
              <span className="dr-badge bg-coral-tint text-[#b8321f]">
                <span className="dr-live-dot bg-coral" />
                Happening now
              </span>
            )}
            {status === "past" && <span className="dr-badge bg-divider text-muted">Ended</span>}
          </div>
          <p className="mt-2 text-sm text-muted">
            Run by{" "}
            <Link href={`/organizations/${event.organizationId}`} className="font-semibold text-ink hover:underline">
              {event.organizationName}
            </Link>
          </p>
        </div>
        {event.canManage && (
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/events/${event.id}/edit`} className="dr-btn-secondary px-4 py-2.5 text-sm">
              <PencilIcon size={16} />
              Edit
            </Link>
            <DeleteEventButton eventId={event.id} organizationId={event.organizationId} eventName={event.name} compact />
          </div>
        )}
      </header>

      <section aria-label="Event details" className="dr-card grid grid-cols-2 gap-x-8 gap-y-5 p-[22px] max-md:grid-cols-1">
        <Detail icon={<CalendarIcon size={16} />} label="When">
          {formatEventRange(event)}
          {(event.hasStartTime || event.hasEndTime) && (
            <span className="mt-0.5 block text-xs text-subtle">{event.timezone.replaceAll("_", " ")} time</span>
          )}
        </Detail>
        <Detail icon={<MapPinIcon size={16} />} label="Where">
          {place.length > 0 ? (
            place.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))
          ) : (
            <span className="text-subtle">Not set</span>
          )}
        </Detail>
        <Detail icon={<TicketIcon size={16} />} label="Capacity">
          {event.capacity ? `${event.capacity.toLocaleString("en-US")} people` : <span className="text-subtle">Not set</span>}
        </Detail>
        <Detail icon={<GlobeIcon size={16} />} label="Links">
          {event.websiteUrl || event.discordUrl ? (
            <span className="flex flex-col gap-1">
              {event.websiteUrl && (
                <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold break-all text-[#0369a1] hover:underline">
                  {event.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}
              {event.discordUrl && (
                <a href={event.discordUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#4752c4] hover:underline">
                  <ChatIcon size={14} />
                  Join the Discord
                </a>
              )}
            </span>
          ) : (
            <span className="text-subtle">Not set</span>
          )}
        </Detail>
      </section>

      {(event.canManage || event.visibility === "public") && (
        <section
          aria-labelledby="event-splash-heading"
          className="dr-card mt-4 flex flex-wrap items-center justify-between gap-4 border-droplet-tint-border bg-droplet-tint p-[22px]"
        >
          <div className="min-w-0">
            <h2 id="event-splash-heading" className="mb-1 text-base font-bold">Splash page</h2>
            <p className="text-sm text-body">
              {event.visibility === "public"
                ? "A public page for this event: no sign-in needed."
                : "Not visible to the public until this event is set to Public."}
            </p>
            {event.visibility === "public" && (
              <p className="mt-2 truncate font-mono text-xs text-muted">/o/{event.organizationSlug}/events/{event.id}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {event.visibility === "public" && (
              <a
                href={`/o/${event.organizationSlug}/events/${event.id}`}
                target="_blank"
                rel="noopener"
                className="dr-btn-primary px-4 py-2.5 text-sm"
              >
                View ↗
              </a>
            )}
            {event.canManage && (
              <Link href={`/events/${event.id}/splash`} className="dr-btn-secondary px-4 py-2.5 text-sm">
                <PencilIcon size={15} />
                Edit
              </Link>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden className="mt-0.5 text-subtle">{icon}</span>
      <div className="min-w-0 text-sm">
        <h2 className="text-xs font-bold tracking-[0.04em] text-subtle uppercase">{label}</h2>
        <div className="mt-0.5 text-ink">{children}</div>
      </div>
    </div>
  );
}
