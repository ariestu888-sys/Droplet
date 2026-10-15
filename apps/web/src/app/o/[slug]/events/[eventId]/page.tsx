import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createDropletApi, DropletApiError, type EventSplashPage } from "@droplet/shared";
import { CalendarIcon, ChatIcon, GlobeIcon, MapPinIcon, TicketIcon } from "@/components/icons";
import { OrgLogo } from "@/components/org-logo";
import { SponsorsFooter } from "@/components/splash/sponsors-footer";
import { countryName } from "@/lib/countries";
import { eventDateBadge, eventStatus, formatEventRange } from "@/lib/event-dates";
import { splashThemeStyle } from "@/lib/splash-theme";
import { isUuid } from "@/lib/uuid";

// A public event's splash page. No sign-in needed. Only events with public
// visibility have one; the API returns 404 for private and hidden events.

export const metadata: Metadata = { title: "Event · Droplet" };

const publicApi = () => createDropletApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL! });

export default function EventSplashRoute({ params }: PageProps<"/o/[slug]/events/[eventId]">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface">
      <Suspense fallback={<p className="p-10 text-center text-sm text-subtle">Loading…</p>}>
        <EventSplash params={params} />
      </Suspense>
    </div>
  );
}

async function EventSplash({ params }: { params: Promise<{ slug: string; eventId: string }> }) {
  const { slug, eventId } = await params;
  // Per-request: whether it's happening now or over depends on the time.
  await connection();
  if (!isUuid(eventId)) notFound();

  let page: EventSplashPage;
  try {
    page = await publicApi().splash.getPublicEvent(slug, eventId);
  } catch (err) {
    if (err instanceof DropletApiError && (err.status === 404 || err.status === 400)) notFound();
    return (
      <p role="alert" className="m-10 rounded-field bg-coral-tint px-4 py-3 text-center text-sm font-semibold text-[#b8321f]">
        This page couldn&apos;t be loaded right now. Please try again in a moment.
      </p>
    );
  }

  const { event, organization: org } = page;
  const badge = eventDateBadge(event.startsAt, event.timezone);
  const status = eventStatus(event.startsAt, event.endsAt);
  const place = [
    event.address,
    [event.city, event.postalCode].filter(Boolean).join(" "),
    event.country ? countryName(event.country) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="dr-splash flex flex-1 flex-col" style={splashThemeStyle(org)}>
      <header className="relative overflow-hidden bg-sky">
        <div aria-hidden className="absolute -top-10 right-[6%] size-48 rounded-full bg-coral opacity-[0.08]" />
        <div aria-hidden className="absolute bottom-6 left-[4%] size-28 rounded-full bg-droplet opacity-[0.08]" />
        <div aria-hidden className="absolute top-16 left-[18%] size-3 rounded-full bg-spark opacity-70" />

        <div className="relative mx-auto w-full max-w-[1120px] px-6 py-12 max-sm:px-4 max-sm:py-9">
          <Link href={`/o/${org.slug}`} className="mb-6 inline-flex items-center gap-2.5 text-sm font-semibold text-ink-soft hover:text-ink">
            <OrgLogo name={org.name} logoUrl={org.logoUrl} size={32} />
            {org.name}
          </Link>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex w-24 shrink-0 flex-col items-center rounded-sheet bg-surface py-3.5 text-droplet shadow-sheet">
              <span className="text-xs font-bold tracking-[0.06em]">{badge.month}</span>
              <span className="font-display text-[40px] leading-none font-bold">{badge.day}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="dr-badge bg-surface text-(--splash-link)">{event.type}</span>
                {status === "live" && (
                  <span className="dr-badge bg-coral-tint text-[#b8321f]">
                    <span className="dr-live-dot bg-coral" />
                    Happening now
                  </span>
                )}
                {status === "past" && <span className="dr-badge bg-divider text-muted">This event has ended</span>}
              </div>
              <h1 className="text-[40px] leading-tight font-bold tracking-[-0.015em] break-words max-sm:text-[32px]">{event.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-[15px] text-ink-soft">
                <CalendarIcon size={16} className="shrink-0 text-droplet" />
                {formatEventRange(event)}
              </p>
              {(event.websiteUrl || event.discordUrl) && (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {event.websiteUrl && (
                    <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" className="dr-btn-secondary px-5 py-2.5 text-sm">
                      <GlobeIcon size={16} />
                      Event website
                    </a>
                  )}
                  {event.discordUrl && (
                    <a
                      href={event.discordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dr-btn-primary bg-[#5865f2] px-5 py-2.5 text-sm text-white shadow-[0_8px_20px_-6px_#5865f2] hover:shadow-[0_14px_26px_-6px_#5865f2]"
                    >
                      <ChatIcon size={16} />
                      Join the Discord
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content, with event details in a right-hand sidebar (below it on narrow screens). */}
      <main className="mx-auto grid w-full max-w-[1120px] flex-1 grid-cols-[minmax(0,1fr)_320px] items-start gap-10 px-6 py-12 max-lg:grid-cols-1 max-sm:px-4 max-sm:py-8">
        {page.html ? (
          // Sanitized by the API when it was saved: no scripts, event handlers or forms.
          <article className="dr-prose" dangerouslySetInnerHTML={{ __html: page.html }} />
        ) : (
          <article className="dr-prose">
            <h2>About this event</h2>
            <p>
              {event.name} is a {event.type.toLowerCase()} run by {org.name}. See the details for when and where, and check
              back here for updates.
            </p>
          </article>
        )}

        <aside aria-labelledby="details-heading" className="lg:sticky lg:top-6">
          <section className="rounded-sheet border-2 border-line-soft bg-canvas p-5">
            <h2 id="details-heading" className="mb-4 font-display text-xl font-bold">Event details</h2>
            <dl className="flex flex-col gap-4 text-sm">
              <Detail icon={<CalendarIcon size={16} />} label="When">
                {formatEventRange(event)}
                {(event.hasStartTime || event.hasEndTime) && (
                  <span className="mt-0.5 block text-xs text-subtle">{event.timezone.replaceAll("_", " ")} time</span>
                )}
              </Detail>
              {place.length > 0 && (
                <Detail icon={<MapPinIcon size={16} />} label="Where">
                  {place.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </Detail>
              )}
              {event.capacity && (
                <Detail icon={<TicketIcon size={16} />} label="Capacity">
                  {event.capacity.toLocaleString("en-US")} people
                </Detail>
              )}
            </dl>
            {status !== "past" && (
              <p className="mt-5 border-t-2 border-divider pt-4 text-center text-xs text-muted">
                <Link href="/login" className="font-semibold text-(--splash-link) hover:underline">Sign in</Link> to sign up for this event.
              </p>
            )}
          </section>
          <Link href={`/o/${org.slug}`} className="mt-3 block text-center text-sm font-semibold text-(--splash-link) hover:underline">
            More from {org.name} →
          </Link>
        </aside>
      </main>

      <SponsorsFooter organizationName={org.name} sponsors={page.sponsors} />
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden className="mt-0.5 text-subtle">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-bold tracking-[0.04em] text-subtle uppercase">{label}</dt>
        <dd className="mt-0.5 text-ink">{children}</dd>
      </div>
    </div>
  );
}
