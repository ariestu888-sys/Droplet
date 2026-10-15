"use server";

import { redirect } from "next/navigation";
import { DropletApiError } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

export async function leaveOrganization(organizationId: string): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.members.leave(organizationId);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 403) return { error: "The owner can't leave their organization." };
    if (err instanceof DropletApiError && err.code === "not_set_up") {
      return { error: "Roles aren't set up in the database yet. Run the latest migration in supabase/migrations." };
    }
    return { error: "Couldn't leave the organization. Please try again." };
  }
  redirect("/home");
}
