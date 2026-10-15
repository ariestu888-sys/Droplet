import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createDropletApi, DropletApiError, ROLE_DESCRIPTIONS, ROLE_LABELS, type JoinLinkDetails, type Profile } from "@droplet/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { OrgLogo } from "@/components/org-logo";
import { createServerApi } from "@/lib/api/server";
import { JoinButton } from "./join-button";

// Where a join link (or its QR code) leads: anyone who signs in can join.

export const metadata: Metadata = { title: "Join · Droplet", robots: { index: false } };

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <Suspense fallback={<AuthShell title="Join"><p className="text-sm text-subtle">Loading…</p></AuthShell>}>
      <Join params={params} />
    </Suspense>
  );
}

async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Per-request: the link's status and who's signed in change.
  await connection();
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();

  let link: JoinLinkDetails;
  try {
    link = await createDropletApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL! }).joinLinks.getPublic(token);
  } catch (err) {
    if (err instanceof DropletApiError && (err.status === 404 || err.status === 400)) notFound();
    return (
      <AuthShell title="Join">
        <p role="alert" className="text-sm text-body">This link couldn&apos;t be loaded right now. Please try again in a moment.</p>
      </AuthShell>
    );
  }

  const org = link.organization;
  const roleLabel = ROLE_LABELS[link.role].toLowerCase();
  const header = (
    <div className="mb-5 flex items-center gap-3.5">
      <OrgLogo name={org.name} logoUrl={org.logoUrl} size={52} />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold">{org.name}</p>
        <p className="text-sm text-muted">
          Join as {/^[aeiou]/.test(roleLabel) ? "an" : "a"} <strong className="text-ink">{roleLabel}</strong>
        </p>
      </div>
    </div>
  );

  if (link.status !== "active") {
    return (
      <AuthShell title="This link has been turned off" subtitle={`Ask ${org.name} for a new link.`}>
        <Link href={`/o/${org.slug}`} className="dr-btn-secondary w-full">Visit {org.name}</Link>
      </AuthShell>
    );
  }

  let me: Profile | null = null;
  try {
    me = await (await createServerApi()).me.get();
  } catch {
    me = null;
  }

  const next = encodeURIComponent(`/join/${token}`);

  return (
    <AuthShell title={`Join ${org.name}`}>
      {header}
      <p className="mb-5 text-sm leading-relaxed text-body">{ROLE_DESCRIPTIONS[link.role]}.</p>
      {me ? (
        <JoinButton token={token} organizationName={org.name} />
      ) : (
        <div className="flex flex-col gap-2.5">
          <Link href={`/signup?next=${next}`} className="dr-btn-primary w-full py-[15px]">Create an account to join</Link>
          <Link href={`/login?next=${next}`} className="dr-btn-secondary w-full">I already have an account</Link>
        </div>
      )}
    </AuthShell>
  );
}
