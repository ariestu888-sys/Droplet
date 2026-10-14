import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, type Organization } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { BuildingPlusIcon, ChatIcon, GlobeIcon, MapPinIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { OrgLogo } from "@/components/org-logo";
import { createServerApi } from "@/lib/api/server";

export const metadata: Metadata = { title: "Home · Droplet" };

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<PageHeader title="Welcome" subtitle="Here's what's happening in your organizations." />}>
        <Greeting />
      </Suspense>

      <section aria-labelledby="orgs-heading" className="dr-card p-[22px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="orgs-heading" className="mb-0.5 text-base font-bold">Your organizations</h2>
            <p className="text-[12.5px] text-subtle">Clubs, leagues and groups you run or belong to</p>
          </div>
          <Link href="/organizations/new" className="dr-btn-primary px-5 py-[11px] text-sm">
            <PlusIcon size={16} />
            Create Organization
          </Link>
        </div>
        <Suspense fallback={<p className="py-6 text-sm text-subtle">Loading your organizations…</p>}>
          <OrganizationList />
        </Suspense>
      </section>
    </>
  );
}

async function Greeting() {
  await connection();
  const profile = await (await createServerApi()).me.get().catch(() => null);
  const firstName = profile?.fullName?.split(" ")[0];
  return (
    <PageHeader
      title={firstName ? `Welcome, ${firstName}` : "Welcome"}
      subtitle="Here's what's happening in your organizations."
    />
  );
}

async function OrganizationList() {
  await connection();
  const api = await createServerApi();

  let organizations: Organization[];
  try {
    organizations = (await api.organizations.list()).data;
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {notSetUp
          ? "Organizations aren't set up in the database yet. Run the migration in supabase/migrations."
          : "Couldn't load your organizations. Is the Droplet API running?"}
      </p>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-field border-2 border-dashed border-line px-6 py-10 text-center">
        <div className="dr-icon-circle bg-droplet-tint text-droplet">
          <BuildingPlusIcon size={22} />
        </div>
        <p className="font-bold">No organizations yet</p>
        <p className="max-w-sm text-sm text-muted">
          Create one for your club, league or band to start posting events and keeping members up to date.
        </p>
        <Link href="/organizations/new" className="dr-btn-secondary mt-1 px-5 py-2.5 text-sm">
          Create your first organization
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
      {organizations.map((org) => (
        <li
          key={org.id}
          // The whole card opens the organization (the name's link stretches over it);
          // the Website and Discord links sit above that layer.
          className="relative flex gap-3.5 rounded-field border-2 border-line-soft p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-droplet-tint-border hover:shadow-card-hover has-[a:focus-visible]:border-droplet"
        >
          <OrgLogo name={org.name} logoUrl={org.logoUrl} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/organizations/${org.id}`}
              className="block truncate font-bold outline-none after:absolute after:inset-0 after:rounded-field hover:text-droplet"
            >
              {org.name}
            </Link>
            <p className="truncate text-[12.5px] font-semibold text-droplet">{org.type}</p>
            {org.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{org.description}</p>}
            {(org.address || org.zipcode) && (
              <p className="mt-1 flex items-center gap-1 truncate text-[12.5px] text-subtle">
                <MapPinIcon size={13} className="shrink-0" />
                <span className="truncate">{[org.address, org.zipcode].filter(Boolean).join(", ")}</span>
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="dr-badge bg-success-tint text-[#11743a]">
                <UsersIcon size={13} />
                {org.role === "owner" ? "Owner" : org.role === "admin" ? "Admin" : "Member"}
              </span>
              {org.websiteUrl && (
                <a href={org.websiteUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 dr-badge bg-droplet-tint text-[#0369a1] hover:underline">
                  <GlobeIcon size={13} />
                  Website
                </a>
              )}
              {org.discordUrl && (
                <a href={org.discordUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 dr-badge bg-[#eef0ff] text-[#4752c4] hover:underline">
                  <ChatIcon size={13} />
                  Discord
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
