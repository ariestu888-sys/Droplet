import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  assignableRoles,
  DropletApiError,
  isOrganizer,
  ROLE_DESCRIPTIONS,
  ORGANIZATION_ROLES,
  type InvitableRole,
  type Invitation,
  type Member,
  type Organization,
  type Profile,
} from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { createServerApi } from "@/lib/api/server";
import { isUuid } from "@/lib/uuid";
import { JoinLinks } from "./join-links";
import { InviteForm, MemberList, PendingInvitations, RoleBadge } from "./members-manager";

export const metadata: Metadata = { title: "Members · Droplet" };

export default function MembersPage({ params }: PageProps<"/organizations/[id]/members">) {
  return (
    <div className="max-w-[860px]">
      <Suspense fallback={<p className="text-sm text-subtle">Loading…</p>}>
        <Members params={params} />
      </Suspense>
    </div>
  );
}

async function Members({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: the Supabase client reads the clock while checking the session.
  await connection();
  if (!isUuid(id)) notFound();

  const api = await createServerApi();
  let org: Organization;
  let me: Profile;
  try {
    [org, me] = await Promise.all([api.organizations.get(id), api.me.get()]);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    return <LoadError />;
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
        <PageHeader title="Members" />
        <p className="dr-card text-sm text-body">Only owners and admins can see and manage {org.name}&apos;s members.</p>
      </>
    );
  }

  let members: Member[];
  let invitations: Invitation[];
  try {
    [{ data: members }, { data: invitations }] = await Promise.all([api.members.list(org.id), api.invitations.list(org.id)]);
  } catch (err) {
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <>
        {back}
        <PageHeader title="Members" />
        {notSetUp ? (
          <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
            Roles and invitations aren&apos;t set up in the database yet. Run the latest migration in supabase/migrations.
          </p>
        ) : (
          <LoadError />
        )}
      </>
    );
  }

  // Join links are optional here: if they aren't set up yet, the rest still works.
  const joinLinks = await api.joinLinks
    .list(org.id)
    .then((r) => r.data)
    .catch(() => null);

  const invitable = assignableRoles(org.role) as InvitableRole[];

  return (
    <>
      {back}
      <PageHeader title="Members" subtitle={`${members.length} ${members.length === 1 ? "person" : "people"} in ${org.name}.`} />

      <div className="flex flex-col gap-4">
        <section aria-labelledby="invite-heading" className="dr-card">
          <h2 id="invite-heading" className="mb-1 text-base font-bold">Invite someone</h2>
          <p className="mb-4 text-sm text-muted">
            {org.role === "owner"
              ? "Invite people as admins, boosters, members or subscribers."
              : "Admins can invite boosters, members and subscribers. Only the owner can add admins."}
          </p>
          <InviteForm organizationId={org.id} roles={invitable} />
        </section>

        <section aria-labelledby="join-links-heading" className="dr-card">
          <h2 id="join-links-heading" className="mb-1 text-base font-bold">Join links and QR codes</h2>
          <p className="mb-4 text-sm text-muted">
            Share a link, or show or print its QR code, so anyone can join without an invitation: on a flyer, a slide or in a
            group chat. Turn a link off or reset it any time.
          </p>
          {joinLinks ? (
            <JoinLinks organizationId={org.id} organizationSlug={org.slug} links={joinLinks} />
          ) : (
            <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
              Join links aren&apos;t set up in the database yet. Run the latest migration in supabase/migrations.
            </p>
          )}
        </section>

        <section aria-labelledby="pending-heading" className="dr-card">
          <h2 id="pending-heading" className="mb-4 text-base font-bold">Pending invitations</h2>
          <PendingInvitations invitations={invitations} actorRole={org.role} />
        </section>

        <section aria-labelledby="members-heading" className="dr-card">
          <h2 id="members-heading" className="mb-4 text-base font-bold">Members</h2>
          <MemberList organizationId={org.id} members={members} actorRole={org.role} actorId={me.id} />
        </section>

        <section aria-labelledby="roles-heading" className="dr-card">
          <h2 id="roles-heading" className="mb-3 text-base font-bold">What each role means</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            {ORGANIZATION_ROLES.map((r) => (
              <div key={r} className="flex flex-wrap items-baseline gap-3">
                <dt className="w-24 shrink-0"><RoleBadge role={r} /></dt>
                <dd className="min-w-0 flex-1 text-body">
                  {ROLE_DESCRIPTIONS[r]}.{" "}
                  <span className="text-subtle">{ACCESS[r]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

const ACCESS: Record<(typeof ORGANIZATION_ROLES)[number], string> = {
  owner: "Everything, including splash colors and adding or removing admins.",
  admin: "Edits pages, events and splash pages; sees hidden events; manages boosters, members and subscribers.",
  booster: "Sees public and private events.",
  member: "Sees public and private events.",
  subscriber: "Sees public events only.",
};

function LoadError() {
  return (
    <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
      Couldn&apos;t load the members. Is the Droplet API running?
    </p>
  );
}
