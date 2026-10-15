import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, isOrganizer, type Organization, type OrganizationType } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { OrganizationForm } from "@/components/organizations/organization-form";
import { createServerApi } from "@/lib/api/server";
import { isUuid } from "@/lib/uuid";
import { updateOrganization } from "./actions";

export const metadata: Metadata = { title: "Edit organization · Droplet" };

export default function EditOrganizationPage({ params }: PageProps<"/organizations/[id]/edit">) {
  return (
    <div className="max-w-[680px]">
      <Suspense fallback={<p className="text-sm text-subtle">Loading…</p>}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: the Supabase client reads the clock while checking the session.
  await connection();
  if (!isUuid(id)) notFound();

  const api = await createServerApi();
  let org: Organization;
  let types: OrganizationType[];
  try {
    [org, { data: types }] = await Promise.all([api.organizations.get(id), api.organizationTypes.list()]);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        Couldn&apos;t load this organization. Is the Droplet API running?
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
        <PageHeader title="Edit organization" />
        <p className="dr-card text-sm text-body">Only owners and admins can edit {org.name}.</p>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader title="Edit organization" subtitle={`Update ${org.name}'s details. Changes show up right away.`} />
      <div className="dr-card">
        <OrganizationForm
          action={updateOrganization.bind(null, org.id)}
          types={types}
          initial={{
            name: org.name,
            type: org.type,
            description: org.description ?? "",
            zipcode: org.zipcode ?? "",
            address: org.address ?? "",
            discordUrl: org.discordUrl ?? "",
            instagramUrl: org.instagramUrl ?? "",
            websiteUrl: org.websiteUrl ?? "",
          }}
          currentLogoUrl={org.logoUrl}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref={`/organizations/${org.id}`}
        />
      </div>
    </>
  );
}
