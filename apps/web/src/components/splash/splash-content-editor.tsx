"use client";

import { useActionState, useState } from "react";
import { FormNotice } from "@/components/auth/auth-shell";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { SplashContentState } from "@/lib/splash-content";

// Editor for a splash page's content (organizations and events).

const STARTER_HTML = `<h2>Welcome to our community!</h2>
<p>Tell visitors who you are, what you do, and how to get involved.</p>
<ul>
  <li><strong>When we meet:</strong> Fridays at 7 PM</li>
  <li><strong>Where:</strong> Cedar Hall</li>
</ul>
<p>Questions? <a href="mailto:hello@example.com">Email us</a>.</p>`;

export function SplashContentEditor({
  action,
  initialHtml,
  starterHtml = STARTER_HTML,
}: {
  /** A server action that saves the content. */
  action: (state: SplashContentState, formData: FormData) => Promise<SplashContentState>;
  initialHtml: string;
  starterHtml?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Set when someone picks the example, to load it into the editor.
  const [example, setExample] = useState<string | null>(null);
  const html = state.html ?? example ?? initialHtml;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
          <span id="splash-content-label" className="dr-field-label mb-0">
            Content
          </span>
          {!html && (
            <button type="button" className="text-xs font-bold text-[#0369a1] hover:underline" onClick={() => setExample(starterHtml)}>
              Start from an example
            </button>
          )}
        </div>
        <RichTextEditor
          // Remount with the saved (cleaned) HTML after each save, or the example.
          key={state.html ?? example ?? "initial"}
          name="html"
          initialHtml={html}
          ariaLabel="Splash page content"
          placeholder="Tell visitors who you are, what you do, and how to get involved…"
        />
        <p id="html-hint" className="mt-1.5 text-xs text-subtle">
          Use the toolbar to format text and add links, images and YouTube videos, or switch to HTML to edit the code.
          Scripts, forms and most styling are removed when you save, to keep visitors safe. Leave it empty to show your
          description instead.
        </p>
      </div>
      <FormNotice state={state} />
      <div>
        <button type="submit" disabled={pending} className="dr-btn-primary disabled:cursor-wait disabled:opacity-70">
          {pending ? "Saving…" : "Save splash content"}
        </button>
      </div>
    </form>
  );
}
