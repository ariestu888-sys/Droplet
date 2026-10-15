"use server";

import { createServerApi } from "@/lib/api/server";
import { checkSplashHtml, savedSplashState, splashErrorState, type SplashContentState } from "@/lib/splash-content";

// Bound to the event's id by the page.
export async function saveEventSplashContent(
  eventId: string,
  _prev: SplashContentState,
  formData: FormData,
): Promise<SplashContentState> {
  const html = String(formData.get("html") ?? "");
  const invalid = checkSplashHtml(html);
  if (invalid) return invalid;

  try {
    const api = await createServerApi();
    return savedSplashState(await api.splash.updateEvent(eventId, { html }));
  } catch (err) {
    return splashErrorState(err, html);
  }
}
