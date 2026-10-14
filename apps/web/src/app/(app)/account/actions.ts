"use server";

import { DropletApiError } from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

export type NameFormState = { error?: string; message?: string; name?: string };

export async function updateName(
  _prev: NameFormState,
  formData: FormData,
): Promise<NameFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Please enter a name." };

  try {
    const api = await createServerApi();
    const profile = await api.me.update({ fullName });
    return { message: "Saved.", name: profile.fullName ?? fullName };
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) {
      return { error: "Your session has expired. Please log in again." };
    }
    if (err instanceof DropletApiError && err.status === 400) {
      return { error: "Names can be up to 100 characters." };
    }
    return { error: "Couldn't save your name. Please try again." };
  }
}
