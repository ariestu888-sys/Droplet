import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createDropletApi, DropletApiError, type SplashEvent, type SplashPage } from "@droplet/shared";
import { CalendarIcon, GlobeIcon, MapPinIcon } from "@/components/icons";
import { SocialLinks } from "@/components/splash/social-links";
import { SubscribeButton } from "./subscribe-button";
import { OrgLogo } from "@/components/org-logo";
import { SponsorsFooter } from "@/components/splash/sponsors-footer";
import { countryName } from "@/lib/countries";
import { eventDateBadge, formatEventRange } from "@/lib/event-dates";
import { splashThemeStyle } from "@/lib/splash-theme";

// An organization's public splash page. No sign-in needed.

export const metadata: Metadata = { title: "Welcome · Droplet" };

const publicApi = () => createDropletApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL! });

export default function SplashPageRoute({ params }: PageProps<"/o/[slug]">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface">
      <Suspense fallback={<p className="p-10 text-center text-sm text-subtle">Loading…</p>}>
        <Splash params={params} />
      </Suspense>
    </div>
  );
}

async function Splash({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Per-request: upcoming events depend on the current time.
  await connection();

  let page: SplashPage;
  try {
    page = await publicApi().splash.getPublic(slug);
  } catch (err) {
    if (err instanceof DropletApiError && (err.status === 404 || err.status === 400)) notFound();
    return (
      <p role="alert" className="m-10 rounded-field bg-coral-tint px-4 py-3 text-center text-sm font-semibold text-[#b8321f]">
        This page couldn&apos;t be loaded right now. Please try again in a moment.
      </p>
    );
  }

  const { organization: org } = page;

  return (
    <div className="dr-splash flex flex-1 flex-col" style={splashThemeStyle(org)}>
      <SplashHeader org={org} />

      {/* Content, with upcoming events in a right-hand sidebar (below it on narrow screens). */}
      <main className="mx-auto grid w-full max-w-[1120px] flex-1 grid-cols-[minmax(0,1fr)_320px] items-start gap-10 px-6 py-12 max-lg:grid-cols-1 max-sm:px-4 max-sm:py-8">
        {page.html ? (
          // Sanitized by the API when it was saved: no scripts, event handlers or forms.
          <article className="dr-prose" dangerouslySetInnerHTML={{ __html: page.html }} />
        ) : (
          <article className="dr-prose">
            <h2>Welcome to {org.name}</h2>
            {org.description ? (
              <p className="whitespace-pre-line">{org.description}</p>
            ) : (
              <p>We&apos;re glad you&apos;re here. Check out our upcoming events.</p>
            )}
          </article>
        )}

        <UpcomingEvents organizationSlug={org.slug} events={page.upcomingEvents} />
      </main>

      <SponsorsFooter organizationName={org.name} sponsors={page.sponsors} />
    </div>
  );
}

function SplashHeader({ org }: { org: SplashPage["organization"] }) {
  const location = [org.address, org.zipcode].filter(Boolean).join(", ");
  const hasSocials = Boolean(org.discordUrl || org.instagramUrl);
  return (
    <header className="relative overflow-hidden bg-sky">
      <div aria-hidden className="absolute -top-10 right-[6%] size-48 rounded-full bg-coral opacity-[0.08]" />
      <div aria-hidden className="absolute bottom-6 left-[4%] size-28 rounded-full bg-droplet opacity-[0.08]" />
      <div aria-hidden className="absolute top-16 left-[18%] size-3 rounded-full bg-spark opacity-70" />

      <div
        className={`relative mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-6 px-6 py-14 max-sm:px-4 max-sm:py-10 ${
          hasSocials ? "max-sm:pt-20" : ""
        }`}
      >
        {/* Social accounts, top right of the banner. */}
        <SocialLinks organizationName={org.name} links={org} className="absolute top-5 right-6 max-sm:top-4 max-sm:right-4" />

        <OrgLogo name={org.name} logoUrl={org.logoUrl} size={96} className="rounded-sheet shadow-sheet" />
        <div className={`min-w-0 flex-1 ${hasSocials ? "sm:pr-28" : ""}`}>
          <span className="dr-badge mb-2 bg-surface text-(--splash-link)">{org.type}</span>
          <h1 className="text-[40px] leading-tight font-bold tracking-[-0.015em] break-words max-sm:text-[32px]">{org.name}</h1>
          {location && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <MapPinIcon size={15} className="shrink-0" />
              {location}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-start gap-2.5">
            <SubscribeButton organizationId={org.id} slug={org.slug} organizationName={org.name} />
            {org.websiteUrl && (
              <a href={org.websiteUrl} target="_blank" rel="noopener noreferrer" className="dr-btn-secondary px-5 py-2.5 text-sm">
                <GlobeIcon size={16} />
                Website
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Right-hand sidebar on wide screens: stays in view while the content scrolls.
function UpcomingEvents({ organizationSlug, events }: { organizationSlug: string; events: SplashEvent[] }) {
  return (
    <aside aria-labelledby="upcoming-heading" className="lg:sticky lg:top-6">
      <section className="rounded-sheet border-2 border-line-soft bg-canvas p-5">
        <h2 id="upcoming-heading" className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
          <CalendarIcon size={20} className="text-droplet" />
          Upcoming events
        </h2>

        {events.length === 0 ? (
          <p className="rounded-field border-2 border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">
            No upcoming events right now. Check back soon!
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {events.map((event) => {
              const badge = eventDateBadge(event.startsAt, event.timezone);
              const place = [event.city, event.country ? countryName(event.country) : null].filter(Boolean).join(", ");
              return (
                <li key={event.id}>
                  <Link
                    href={`/o/${organizationSlug}/events/${event.id}`}
                    className="flex gap-3 rounded-field border-2 border-line-soft bg-surface p-3 transition-colors hover:border-droplet-tint-border hover:bg-hover"
                  >
                  <div className="flex w-12 shrink-0 flex-col items-center self-start rounded-field bg-droplet-tint py-1.5 text-droplet">
                    <span className="text-[10.5px] font-bold tracking-[0.06em]">{badge.month}</span>
                    <span className="font-display text-xl leading-none font-bold">{badge.day}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14.5px] leading-snug font-bold break-words">{event.name}</p>
                    <p className="mt-0.5 text-xs font-semibold text-droplet">{event.type}</p>
                    <p className="mt-1 text-xs leading-snug text-muted">{formatEventRange(event)}</p>
                    {place && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
                        <MapPinIcon size={12} className="shrink-0" />
                        {place}
                      </p>
                    )}
                  </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {events.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted">
            <Link href="/login" className="font-semibold text-(--splash-link) hover:underline">Sign in</Link> to sign up for events.
          </p>
        )}
      </section>
    </aside>
  );
}
