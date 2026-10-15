"use server";

import { redirect } from "next/navigation";
import { DropletApiError } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

// Bound to the join link's token by the page.
export async function joinWithLink(token: string): Promise<{ error?: string }> {
  let organizationId: string;
  try {
    const api = await createServerApi();
    organizationId = (await api.joinLinks.accept(token)).organizationId;
  } catch (err) {
    if (err instanceof DropletApiError) {
      if (err.status === 401) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
      if (err.status === 400 || err.status === 404) return { error: err.message };
    }
    return { error: "Couldn't join. Please try again." };
  }
  redirect(`/organizations/${organizationId}`);
}
