"use client";

import { useActionState, useState, useTransition } from "react";
import {
  canManageRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type InvitableRole,
  type Invitation,
  type Member,
  type OrganizationRoleName,
} from "@droplet/shared";
import { FormNotice } from "@/components/auth/auth-shell";
import { FormField } from "@/components/forms/form-fields";
import { TrashIcon } from "@/components/icons";
import { cancelInvitation, changeMemberRole, inviteMember, removeMember, type InviteState } from "./actions";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const ROLE_BADGE: Record<OrganizationRoleName, string> = {
  owner: "bg-droplet-tint text-[#0369a1]",
  admin: "bg-droplet-tint text-[#0369a1]",
  booster: "bg-[#fff7e0] text-[#8a5a00]",
  member: "bg-success-tint text-[#11743a]",
  subscriber: "bg-divider text-ink-soft",
};

export function RoleBadge({ role }: { role: OrganizationRoleName }) {
  return <span className={`dr-badge ${ROLE_BADGE[role]}`}>{ROLE_LABELS[role]}</span>;
}

// Invite someone by email with a role.
export function InviteForm({ organizationId, roles }: { organizationId: string; roles: InvitableRole[] }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteMember.bind(null, organizationId), {});
  const [role, setRole] = useState<InvitableRole>(roles.includes("member") ? "member" : roles[0]!);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        // Clear the email after each successful invite.
        key={state.inviteUrl ?? "invite"}
        className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end"
        noValidate
      >
        <FormField name="email" label="Email address">
          {(props) => <input {...props} type="email" placeholder="jamie@example.com" autoComplete="off" required />}
        </FormField>
        <FormField name="role" label="Role">
          {(props) => (
            <select {...props} value={role} onChange={(e) => setRole(e.target.value as InvitableRole)} className={`${props.className} cursor-pointer`}>
              {roles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          )}
        </FormField>
        <button type="submit" disabled={pending} className="dr-btn-primary py-3 disabled:cursor-wait disabled:opacity-70">
          {pending ? "Inviting…" : "Send invite"}
        </button>
      </form>
      <p className="-mt-2 text-xs text-subtle">
        {ROLE_LABELS[role]}: {ROLE_DESCRIPTIONS[role]}. Invite links expire after 14 days and only work for that email address.
      </p>

      {state.error && <FormNotice state={{ error: state.error }} />}
      {state.inviteUrl && (
        <div role="status" className="flex flex-col gap-2 rounded-field bg-success-tint px-4 py-3 text-sm text-[#11743a]">
          <p className="font-semibold">
            {state.emailSent
              ? `Invitation emailed to ${state.sentTo}.`
              : `Invitation created for ${state.sentTo}. Email isn't set up yet, so send them this link yourself:`}
          </p>
          <CopyLink url={state.inviteUrl} />
        </div>
      )}
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border-2 border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="dr-btn-secondary shrink-0 px-3 py-1.5 text-xs"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function PendingInvitations({ invitations, actorRole }: { invitations: Invitation[]; actorRole: OrganizationRoleName }) {
  if (invitations.length === 0) return <p className="text-sm text-subtle">No pending invitations.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {invitations.map((inv) => (
        <InvitationRow key={inv.id} invitation={inv} canCancel={canManageRole(actorRole, inv.role)} />
      ))}
    </ul>
  );
}

function InvitationRow({ invitation, canCancel }: { invitation: Invitation; canCancel: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  return (
    <li className="flex flex-col gap-2 rounded-field border-2 border-line-soft p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{invitation.email}</p>
          <p className="text-xs text-subtle">Expires {formatDate(invitation.expiresAt)}</p>
        </div>
        <RoleBadge role={invitation.role} />
        <button type="button" onClick={() => setShowLink((s) => !s)} className="dr-btn-ghost px-3 py-2 text-sm">
          {showLink ? "Hide link" : "Link"}
        </button>
        {canCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await cancelInvitation(invitation.id);
                if (result.error) setError(result.error);
              })
            }
            className="dr-btn-ghost px-3 py-2 text-sm text-[#b8321f] disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
      {showLink && <CopyLink url={invitation.inviteUrl} />}
      {error && <p role="alert" className="text-xs font-semibold text-[#b8321f]">{error}</p>}
    </li>
  );
}

export function MemberList({
  organizationId,
  members,
  actorRole,
  actorId,
}: {
  organizationId: string;
  members: Member[];
  actorRole: OrganizationRoleName;
  actorId: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => (
        <MemberRow
          key={m.userId}
          organizationId={organizationId}
          member={m}
          isYou={m.userId === actorId}
          canManage={m.userId !== actorId && canManageRole(actorRole, m.role)}
          actorRole={actorRole}
        />
      ))}
    </ul>
  );
}

function MemberRow({
  organizationId,
  member,
  isYou,
  canManage,
  actorRole,
}: {
  organizationId: string;
  member: Member;
  isYou: boolean;
  canManage: boolean;
  actorRole: OrganizationRoleName;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = member.fullName || member.email || "Unnamed member";
  const options = (["admin", "booster", "member", "subscriber"] as const).filter((r) => canManageRole(actorRole, r));

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  return (
    <li className="flex flex-col gap-2 rounded-field border-2 border-line-soft p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-droplet-tint font-display text-sm font-bold text-droplet">
          {name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {name} {isYou && <span className="font-normal text-subtle">(you)</span>}
          </p>
          <p className="truncate text-xs text-subtle">
            {member.fullName && member.email ? `${member.email} · ` : ""}Joined {formatDate(member.joinedAt)}
          </p>
        </div>
        {canManage ? (
          <>
            <label className="sr-only" htmlFor={`role-${member.userId}`}>Role for {name}</label>
            <select
              id={`role-${member.userId}`}
              value={member.role}
              disabled={pending}
              onChange={(e) => run(() => changeMemberRole(organizationId, member.userId, e.target.value as InvitableRole))}
              className="h-9 cursor-pointer rounded-lg border-2 border-line bg-surface px-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {options.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {confirmRemove ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  autoFocus
                  disabled={pending}
                  onClick={() => run(() => removeMember(organizationId, member.userId))}
                  className="dr-btn-primary bg-[#c2341f] px-3 py-2 text-xs shadow-none hover:shadow-none disabled:opacity-60"
                >
                  {pending ? "Removing…" : "Remove"}
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="dr-btn-ghost px-2 py-2 text-xs">
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => setConfirmRemove(true)}
                className="dr-btn-ghost px-2.5 py-2 text-sm text-[#b8321f]"
              >
                <TrashIcon size={16} />
              </button>
            )}
          </>
        ) : (
          <RoleBadge role={member.role} />
        )}
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[#b8321f]">{error}</p>}
    </li>
  );
}
