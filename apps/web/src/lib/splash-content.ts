import { DropletApiError, SPLASH_HTML_MAX_LENGTH, type SplashContent } from "@droplet/shared";

// Saving splash page content (organizations and events).

export type SplashContentState = { error?: string; message?: string; html?: string };

export function checkSplashHtml(html: string): SplashContentState | null {
  if (html.length > SPLASH_HTML_MAX_LENGTH) {
    return { error: "That's too long. A splash page can be up to 100,000 characters.", html };
  }
  return null;
}

export function savedSplashState(saved: SplashContent): SplashContentState {
  return {
    html: saved.html ?? "",
    // The API removes unsafe markup and says when it did.
    message: saved.removedUnsafeContent
      ? "Saved. Some parts were removed for safety (for example scripts, forms or embeds from unsupported sites)."
      : "Saved.",
  };
}

export function splashErrorState(err: unknown, html: string): SplashContentState {
  let error = "Couldn't save the splash page. Please try again.";
  if (err instanceof DropletApiError) {
    if (err.status === 401) error = "Your session has expired. Please log in again.";
    else if (err.status === 403) error = "Only organizers can change the splash page.";
    else if (err.code === "not_set_up") {
      error = "Splash pages aren't fully set up in the database yet. Run the latest migration in supabase/migrations.";
    } else if (err.status === 400 || err.status === 413) error = err.message;
  }
  return { error, html };
}
