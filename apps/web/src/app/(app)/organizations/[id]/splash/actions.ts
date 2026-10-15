"use server";

import { refresh } from "next/cache";
import {
  CreateSponsorSchema,
  DropletApiError,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  SPLASH_HTML_MAX_LENGTH,
} from "@droplet/shared";
import { createServerApi } from "@/lib/api/server";

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

export type SplashContentState = { error?: string; message?: string; html?: string };

// Bound to the organization's id by the page.
export async function saveSplashContent(
  organizationId: string,
  _prev: SplashContentState,
  formData: FormData,
): Promise<SplashContentState> {
  const html = String(formData.get("html") ?? "");
  if (html.length > SPLASH_HTML_MAX_LENGTH) {
    return { error: "That's too long. The splash page can be up to 100,000 characters.", html };
  }

  try {
    const api = await createServerApi();
    const saved = await api.splash.update(organizationId, { html });
    return {
      html: saved.html ?? "",
      // The API removes unsafe markup and says when it did.
      message: saved.removedUnsafeContent
        ? "Saved. Some parts were removed for safety (for example scripts, forms or embeds from unsupported sites)."
        : "Saved.",
    };
  } catch (err) {
    return { error: describeError(err, "save the splash page"), html };
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
