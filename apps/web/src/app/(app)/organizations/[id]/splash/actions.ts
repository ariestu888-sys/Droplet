"use server";

import { refresh } from "next/cache";
import {
  CreateSponsorSchema,
  SplashColorsSchema,
  DropletApiError,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
} from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";
import { checkSplashHtml, savedSplashState, splashErrorState, type SplashContentState } from "@/lib/splash-content";

function describeError(err: unknown, action: string) {
  if (err instanceof DropletApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403) return "Only organizers can change the splash page.";
    if (err.code === "not_set_up") {
      return "Splash pages aren't set up in the database yet. Run the latest migration in supabase/migrations.";
    }
    if (err.status === 400 || err.status === 413) return err.message;
  }
  return `Couldn't ${action}. Please try again.`;
}

// Bound to the organization's id by the page.
export async function saveSplashContent(
  organizationId: string,
  _prev: SplashContentState,
  formData: FormData,
): Promise<SplashContentState> {
  const html = String(formData.get("html") ?? "");
  const invalid = checkSplashHtml(html);
  if (invalid) return invalid;

  try {
    const api = await createServerApi();
    return savedSplashState(await api.splash.update(organizationId, { html }));
  } catch (err) {
    return splashErrorState(err, html);
  }
}

export type SponsorFormState = { error?: string; message?: string };

export async function addSponsor(
  organizationId: string,
  _prev: SponsorFormState,
  formData: FormData,
): Promise<SponsorFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
  const parsed = CreateSponsorSchema.safeParse({ name, websiteUrl: websiteUrl || undefined });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.path[0] === "name" ? "Enter the sponsor's name." : (issue?.message ?? "Check the sponsor's details.") };
  }

  const file = formData.get("logo");
  const logo = file instanceof File && file.size > 0 ? file : null;
  if (logo && !(LOGO_TYPES as readonly string[]).includes(logo.type)) return { error: "Logos must be PNG, JPG or WebP images." };
  if (logo && logo.size > LOGO_MAX_BYTES) return { error: "Logos can be up to 2 MB." };

  const api = await createServerApi();
  try {
    const sponsor = await api.sponsors.create(organizationId, parsed.data);
    if (logo) await api.sponsors.uploadLogo(sponsor.id, logo, logo.name);
  } catch (err) {
    return { error: describeError(err, "add the sponsor") };
  }

  refresh();
  return { message: `Added ${parsed.data.name}.` };
}

export async function removeSponsor(sponsorId: string): Promise<{ error?: string }> {
  try {
    const api = await createServerApi();
    await api.sponsors.delete(sponsorId);
  } catch (err) {
    return { error: describeError(err, "remove the sponsor") };
  }
  refresh();
  return {};
}

export type SplashColorsState = { error?: string; message?: string };

// Bound to the organization's id by the page. Blank colors go back to the default.
export async function saveSplashColors(
  organizationId: string,
  _prev: SplashColorsState,
  formData: FormData,
): Promise<SplashColorsState> {
  const read = (key: string) => {
    const value = String(formData.get(key) ?? "").trim().toLowerCase();
    return value === "" ? null : value;
  };
  const input = { primaryColor: read("primaryColor"), secondaryColor: read("secondaryColor") };
  const parsed = SplashColorsSchema.safeParse(input);
  if (!parsed.success) return { error: "Use six-digit hex colors, like #0ea5e9." };

  try {
    const api = await createServerApi();
    await api.splash.updateColors(organizationId, parsed.data);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 403) return { error: "Only the owner can change splash page colors." };
    if (err instanceof DropletApiError && err.code === "not_set_up") {
      return { error: "Splash colors aren't set up in the database yet. Run the latest migration in supabase/migrations." };
    }
    return { error: "Couldn't save the colors. Please try again." };
  }

  refresh();
  return { message: parsed.data.primaryColor || parsed.data.secondaryColor ? "Colors saved." : "Back to Droplet's default colors." };
}
