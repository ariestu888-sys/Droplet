"use server";

import { redirect } from "next/navigation";
import { DropletApiError } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

// Bound to the invite token by the page.
export async function acceptInvitation(token: string): Promise<{ error?: string }> {
  let organizationId: string;
  try {
    const api = await createServerApi();
    organizationId = (await api.invitations.accept(token)).organizationId;
  } catch (err) {
    if (err instanceof DropletApiError) {
      if (err.status === 401) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      if (err.status === 400 || err.status === 403 || err.status === 404) return { error: err.message };
    }
    return { error: "Couldn't accept the invitation. Please try again." };
  }
  redirect(`/organizations/${organizationId}`);
}
