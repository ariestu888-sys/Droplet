import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  createDropletApi,
  DropletApiError,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type InvitationDetails,
  type Profile,
} from "@droplet/shared";
import { signOut } from "@/app/auth/actions";
import { AuthShell, TextLink } from "@/components/auth/auth-shell";
import { OrgLogo } from "@/components/org-logo";
import { createServerApi } from "@/lib/api/server";
import { AcceptInvitationButton } from "./accept-button";

// Where an invite link leads. Anyone holding the link can see the invite;
// only the invited email's account can accept it.

export const metadata: Metadata = { title: "Invitation · Droplet", robots: { index: false } };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<AuthShell title="Invitation"><p className="text-sm text-subtle">Loading…</p></AuthShell>}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Per-request: the invite's status and who's signed in change.
  await connection();
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();

  let invite: InvitationDetails;
  try {
    invite = await createDropletApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL! }).invitations.getPublic(token);
  } catch (err) {
    if (err instanceof DropletApiError && (err.status === 404 || err.status === 400)) notFound();
    return (
      <AuthShell title="Invitation">
        <p role="alert" className="text-sm text-body">This invitation couldn&apos;t be loaded right now. Please try again in a moment.</p>
      </AuthShell>
    );
  }

  const org = invite.organization;
  const roleLabel = ROLE_LABELS[invite.role].toLowerCase();
  const header = (
    <div className="mb-5 flex items-center gap-3.5">
      <OrgLogo name={org.name} logoUrl={org.logoUrl} size={52} />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold">{org.name}</p>
        <p className="text-sm text-muted">
          Invites you to join as {/^[aeiou]/.test(roleLabel) ? "an" : "a"} <strong className="text-ink">{roleLabel}</strong>
        </p>
      </div>
    </div>
  );

  if (invite.status !== "pending") {
    const why = {
      accepted: "This invitation has already been accepted.",
      revoked: "This invitation was cancelled by the organization.",
      expired: "This invitation has expired.",
    }[invite.status];
    return (
      <AuthShell title="Invitation no longer valid" subtitle={`${why} Ask ${org.name} to send you a new one.`}>
        <Link href={`/o/${org.slug}`} className="dr-btn-secondary w-full">
          Visit {org.name}
        </Link>
      </AuthShell>
    );
  }

  // Who's signed in, if anyone.
  let me: Profile | null = null;
  try {
    me = await (await createServerApi()).me.get();
  } catch {
    me = null;
  }

  const next = encodeURIComponent(`/invite/${token}`);

  if (!me) {
    return (
      <AuthShell title="You're invited" footer={<>Already joined? <TextLink href="/login">Log in</TextLink></>}>
        {header}
        <p className="mb-5 text-sm leading-relaxed text-body">
          {ROLE_DESCRIPTIONS[invite.role]}. This invitation is for <strong className="text-ink">{invite.email}</strong>: sign in
          or create an account with that email to accept it.
        </p>
        <div className="flex flex-col gap-2.5">
          <Link href={`/signup?next=${next}`} className="dr-btn-primary w-full py-[15px]">Create an account</Link>
          <Link href={`/login?next=${next}`} className="dr-btn-secondary w-full">I already have an account</Link>
        </div>
      </AuthShell>
    );
  }

  if ((me.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <AuthShell title="This invitation is for someone else">
        {header}
        <p className="mb-5 text-sm leading-relaxed text-body">
          You&apos;re signed in as <strong className="text-ink">{me.email}</strong>, but this invitation was sent to{" "}
          <strong className="text-ink">{invite.email}</strong>. Log out, then sign in with that email to accept it.
        </p>
        <form action={signOut}>
          <input type="hidden" name="next" value={`/invite/${token}`} />
          <button type="submit" className="dr-btn-secondary w-full">Log out and switch account</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="You're invited">
      {header}
      <p className="mb-5 text-sm leading-relaxed text-body">{ROLE_DESCRIPTIONS[invite.role]}.</p>
      <AcceptInvitationButton token={token} organizationName={org.name} />
    </AuthShell>
  );
}
