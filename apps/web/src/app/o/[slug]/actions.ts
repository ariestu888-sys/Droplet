"use server";

import { redirect } from "next/navigation";
import { DropletApiError, type OrganizationRoleName } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

export type SubscribeState = { role?: OrganizationRoleName; error?: string };

// Bound to the organization's id and slug by the splash page. Signed-out
// visitors are sent to log in and brought back here.
export async function subscribe(organizationId: string, slug: string): Promise<SubscribeState> {
  try {
    const api = await createServerApi();
    const { role } = await api.members.subscribe(organizationId);
    return { role };
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect(`/login?next=${encodeURIComponent(`/o/${slug}`)}`);
    if (err instanceof DropletApiError && err.code === "not_set_up") {
      return { error: "Subscribing isn't set up yet. Please try again later." };
    }
    return { error: "Couldn't subscribe. Please try again." };
  }
}
