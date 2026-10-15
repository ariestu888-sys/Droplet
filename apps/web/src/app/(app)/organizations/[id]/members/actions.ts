"use server";

import { refresh } from "next/cache";
import { CreateInvitationSchema, DropletApiError, type InvitableRole, type JoinLinkRole } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

function describeError(err: unknown, action: string) {
  if (err instanceof DropletApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403 || err.status === 400 || err.status === 404) return err.message;
    if (err.code === "not_set_up") {
      return "Roles and invitations aren't set up in the database yet. Run the latest migration in supabase/migrations.";
    }
  }
  return `Couldn't ${action}. Please try again.`;
}

export type InviteState = {
  error?: string;
  // Set after an invite is created.
  sentTo?: string;
  inviteUrl?: string;
  emailSent?: boolean;
};

// Bound to the organization's id by the page.
export async function inviteMember(organizationId: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = CreateInvitationSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.path[0] === "email" ? "Enter a valid email address." : "Choose a role." };
  }

  try {
    const api = await createServerApi();
    const result = await api.invitations.create(organizationId, parsed.data);
    refresh();
    return { sentTo: result.invitation.email, inviteUrl: result.invitation.inviteUrl, emailSent: result.emailSent };
  } catch (err) {
    return { error: describeError(err, "create the invitation") };
  }
}

export async function cancelInvitation(invitationId: string): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.invitations.revoke(invitationId);
  } catch (err) {
    return { error: describeError(err, "cancel the invitation") };
  }
  refresh();
  return {};
}

export async function changeMemberRole(organizationId: string, userId: string, role: InvitableRole): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.members.setRole(organizationId, userId, { role });
  } catch (err) {
    return { error: describeError(err, "change the role") };
  }
  refresh();
  return {};
}

export async function removeMember(organizationId: string, userId: string): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.members.remove(organizationId, userId);
  } catch (err) {
    return { error: describeError(err, "remove them") };
  }
  refresh();
  return {};
}

// Creates (or resets) the join link for a role; any old link stops working.
export async function createJoinLink(organizationId: string, role: JoinLinkRole): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.joinLinks.create(organizationId, { role });
  } catch (err) {
    return { error: describeError(err, "create the join link") };
  }
  refresh();
  return {};
}

export async function turnOffJoinLink(linkId: string): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.joinLinks.revoke(linkId);
  } catch (err) {
    return { error: describeError(err, "turn off the join link") };
  }
  refresh();
  return {};
}
