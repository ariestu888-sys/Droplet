import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, type OrganizationType } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { createServerApi } from "@/lib/api/server";
import { OrganizationForm } from "@/components/organizations/organization-form";
import { createOrganization } from "./actions";

export const metadata: Metadata = { title: "Create Organization · Droplet" };

export default function NewOrganizationPage() {
  return (
    <div className="max-w-[680px]">
      <PageHeader
        title="Create Organization"
        subtitle="Set up your club, league or group. You'll be its owner."
      />
      <div className="dr-card">
        <Suspense fallback={<p className="text-sm text-subtle">Loading…</p>}>
          <FormWithTypes />
        </Suspense>
      </div>
    </div>
  );
}

async function FormWithTypes() {
  await connection();
  let types: OrganizationType[];
  try {
    types = (await (await createServerApi()).organizationTypes.list()).data;
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {notSetUp
          ? "Organizations aren't fully set up in the database yet. Run the latest migration in supabase/migrations."
          : "Couldn't load this form. Is the Droplet API running?"}
      </p>
    );
  }
  return (
    <OrganizationForm
      action={createOrganization}
      types={types}
      submitLabel="Create Organization"
      pendingLabel="Creating…"
      cancelHref="/home"
    />
  );
}
