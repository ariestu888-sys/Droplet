import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, type DropletEvent, type Organization } from "@droplet/shared";
import { EventList } from "@/components/events/event-list";
import { ChatIcon, GlobeIcon, InstagramIcon, MapPinIcon, PencilIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { OrgLogo } from "@/components/org-logo";
import { createServerApi } from "@/lib/api/server";
import { instagramHandle } from "@/lib/instagram";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Organization · Droplet" };

export default function OrganizationPage({ params }: PageProps<"/organizations/[id]">) {
  return (
    <div className="max-w-[960px]">
      <Link href="/home" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <span aria-hidden>←</span> Home
      </Link>
      <Suspense fallback={<p className="text-sm text-subtle">Loading organization…</p>}>
        <OrganizationDetails params={params} />
      </Suspense>
    </div>
  );
}


async function OrganizationDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: the Supabase client reads the clock while checking the session.
  await connection();
  if (!isUuid(id)) notFound();

  let org: Organization;
  try {
    org = await (await createServerApi()).organizations.get(id);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        Couldn&apos;t load this organization. Is the Droplet API running?
      </p>
    );
  }

  const location = [org.address, org.zipcode].filter(Boolean).join(", ");
  const roleLabel = org.role === "owner" ? "Owner" : org.role === "admin" ? "Admin" : "Member";
  const created = new Date(org.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <header className="mb-7 flex flex-wrap items-center gap-5">
        <OrgLogo name={org.name} logoUrl={org.logoUrl} size={80} className="rounded-card" />
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 text-[28px] leading-tight font-bold tracking-[-0.01em] break-words">{org.name}</h1>
          <div className="flex flex-wrap gap-2">
            <span className="dr-badge bg-droplet-tint text-[#0369a1]">{org.type}</span>
            <span className="dr-badge bg-success-tint text-[#11743a]">
              <UsersIcon size={13} />
              You&apos;re {org.role === "member" ? "a member" : `an ${roleLabel.toLowerCase()}`}
            </span>
          </div>
        </div>
        {org.role !== "member" && (
          <Link href={`/organizations/${org.id}/edit`} className="dr-btn-secondary px-5 py-2.5 text-sm">
            <PencilIcon size={16} />
            Edit
          </Link>
        )}
      </header>

      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-4 max-lg:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="about-heading" className="dr-card p-[22px]">
            <h2 id="about-heading" className="mb-3 text-base font-bold">About</h2>
            {org.description ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-body">{org.description}</p>
            ) : (
              <p className="text-sm text-subtle">No description yet.</p>
            )}
          </section>

          <section aria-labelledby="events-heading" className="dr-card p-[22px]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="events-heading" className="text-base font-bold">Events</h2>
              {org.role !== "member" && (
                <Link href={`/organizations/${org.id}/events/new`} className="dr-btn-primary px-4 py-2.5 text-sm">
                  <PlusIcon size={16} />
                  Create event
                </Link>
              )}
            </div>
            <Suspense fallback={<p className="text-sm text-subtle">Loading events…</p>}>
              <OrganizationEvents organizationId={org.id} canManage={org.role !== "member"} />
            </Suspense>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="splash-heading" className="dr-card border-droplet-tint-border bg-droplet-tint p-[22px]">
            <h2 id="splash-heading" className="mb-1 text-base font-bold">Splash page</h2>
            <p className="mb-3 text-sm text-body">Your public page for visitors: no sign-in needed.</p>
            <p className="mb-4 truncate rounded-field bg-surface px-3 py-2 font-mono text-xs text-muted">/o/{org.slug}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/o/${org.slug}`} target="_blank" rel="noopener" className="dr-btn-primary px-4 py-2.5 text-sm">
                View ↗
              </a>
              {org.role !== "member" && (
                <Link href={`/organizations/${org.id}/splash`} className="dr-btn-secondary px-4 py-2.5 text-sm">
                  <PencilIcon size={15} />
                  Edit
                </Link>
              )}
            </div>
          </section>

          <section aria-labelledby="details-heading" className="dr-card p-[22px]">
            <h2 id="details-heading" className="mb-3 text-base font-bold">Details</h2>
            <dl className="flex flex-col gap-3.5 text-sm">
              <Detail icon={<MapPinIcon size={16} />} label="Location">
                {location || <span className="text-subtle">Not set</span>}
              </Detail>
              <Detail icon={<GlobeIcon size={16} />} label="Website">
                {org.websiteUrl ? (
                  <a href={org.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold break-all text-[#0369a1] hover:underline">
                    {org.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                ) : (
                  <span className="text-subtle">Not set</span>
                )}
              </Detail>
              <Detail icon={<ChatIcon size={16} />} label="Discord">
                {org.discordUrl ? (
                  <a href={org.discordUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#4752c4] hover:underline">
                    Join the Discord
                  </a>
                ) : (
                  <span className="text-subtle">Not set</span>
                )}
              </Detail>
              <Detail icon={<InstagramIcon size={16} />} label="Instagram">
                {org.instagramUrl ? (
                  <a href={org.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#c13584] hover:underline">
                    {instagramHandle(org.instagramUrl)}
                  </a>
                ) : (
                  <span className="text-subtle">Not set</span>
                )}
              </Detail>
            </dl>
            <p className="mt-4 border-t-2 border-divider pt-3.5 text-xs text-subtle">Created {created}</p>
          </section>
        </div>
      </div>
    </>
  );
}

async function OrganizationEvents({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  // Per-request: "upcoming" and "past" depend on the current time.
  await connection();
  let events: DropletEvent[];
  try {
    events = (await (await createServerApi()).events.listForOrganization(organizationId)).data;
  } catch (err) {
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {notSetUp
          ? "Events aren't set up in the database yet. Run the latest migration in supabase/migrations."
          : "Couldn't load events."}
      </p>
    );
  }

  return (
    <EventList
      events={events}
      emptyAction={
        canManage ? (
          <Link href={`/organizations/${organizationId}/events/new`} className="dr-btn-secondary px-5 py-2.5 text-sm">
            Create the first event
          </Link>
        ) : (
          <p className="text-sm text-muted">Events will show up here once they&apos;re announced.</p>
        )
      }
    />
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
