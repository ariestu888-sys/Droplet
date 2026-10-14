import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { createServerApi } from "@/lib/api/server";
import { NameForm } from "./name-form";

export const metadata: Metadata = { title: "Your account · Droplet" };

async function AccountDetails() {
  // Per-request: reads the session cookie and calls the API.
  await connection();
  const api = await createServerApi();

  let profile;
  try {
    profile = await api.me.get();
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        Couldn&apos;t load your account right now. Is the Droplet API running?
      </p>
    );
  }

  const provider = profile.provider === "google" ? "Google" : "Email and password";

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col gap-3 text-sm">
        <Detail label="Email" value={profile.email ?? "—"} />
        <Detail label="Signed in with" value={provider} />
      </dl>
      <NameForm initialName={profile.fullName ?? ""} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-field bg-droplet-tint px-4 py-3">
      <dt className="font-bold text-ink-soft">{label}</dt>
      <dd className="min-w-0 truncate text-body">{value}</dd>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="max-w-[640px]">
      <PageHeader title="Account" subtitle="Your Droplet profile and sign-in details." />
      <div className="dr-card">
        <Suspense fallback={<p className="text-sm text-subtle">Loading your details…</p>}>
          <AccountDetails />
        </Suspense>
      </div>
    </div>
  );
}
