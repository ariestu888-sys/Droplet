import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, type DropletEvent, type SplashContent } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { SplashContentEditor } from "@/components/splash/splash-content-editor";
import { createServerApi } from "@/lib/api/server";
import { isUuid } from "@/lib/uuid";
import { saveEventSplashContent } from "./actions";

export const metadata: Metadata = { title: "Edit event splash page · Droplet" };

const EVENT_STARTER_HTML = `<h2>Join us!</h2>
<p>Tell people what this event is about and why they should come.</p>
<h3>Schedule</h3>
<ul>
  <li><strong>9:00 AM</strong> Check-in</li>
  <li><strong>10:00 AM</strong> Opening round</li>
</ul>
<h3>What to bring</h3>
<p>List anything attendees need, and where to find you on the day.</p>`;

export default function EditEventSplashPage({ params }: PageProps<"/events/[id]/splash">) {
  return (
    <div className="max-w-[820px]">
      <Suspense fallback={<p className="text-sm text-subtle">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Per-request: the Supabase client reads the clock while checking the session.
  await connection();
  if (!isUuid(id)) notFound();

  const api = await createServerApi();
  let event: DropletEvent;
  let content: SplashContent;
  try {
    [event, content] = await Promise.all([api.events.get(id), api.splash.getEvent(id)]);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {notSetUp
          ? "Event splash pages aren't set up in the database yet. Run the latest migration in supabase/migrations."
          : "Couldn't load the splash page editor. Is the Droplet API running?"}
      </p>
    );
  }

  const back = (
    <Link href={`/events/${event.id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
      <span aria-hidden>←</span> {event.name}
    </Link>
  );

  if (!event.canManage) {
    return (
      <>
        {back}
        <PageHeader title="Event splash page" />
        <p className="dr-card text-sm text-body">Only organizers can edit this event&apos;s splash page.</p>
      </>
    );
  }

  const publicUrl = `/o/${event.organizationSlug}/events/${event.id}`;

  return (
    <>
      {back}
      <PageHeader
        title="Event splash page"
        subtitle="A public page for this event, no sign-in needed. Share its link anywhere."
        actions={
          event.visibility === "public" ? (
            <a href={publicUrl} target="_blank" rel="noopener" className="dr-btn-secondary px-5 py-2.5 text-sm">
              View page ↗
            </a>
          ) : undefined
        }
      />

      {event.visibility !== "public" && (
        <p role="status" className="mb-4 rounded-field border-2 border-[#f5d48a] bg-[#fff7e0] px-4 py-3 text-sm text-[#7a5200]">
          <strong>Not visible yet.</strong> This event is {event.visibility === "hidden" ? "Hidden" : "Private"}, so its
          splash page can&apos;t be seen by the public. You can still prepare it here; it goes live when you{" "}
          <Link href={`/events/${event.id}/edit`} className="font-semibold underline">
            set the event to Public
          </Link>
          .
        </p>
      )}

      <section aria-labelledby="content-heading" className="dr-card">
        <h2 id="content-heading" className="mb-1 text-base font-bold">Splash content</h2>
        <p className="mb-4 text-sm text-muted">
          Shown under the event&apos;s name and dates. The event&apos;s details (when, where, capacity) appear beside it
          automatically, and {event.organizationName}&apos;s sponsors in the footer.
        </p>
        <SplashContentEditor
          action={saveEventSplashContent.bind(null, event.id)}
          initialHtml={content.html ?? ""}
          starterHtml={EVENT_STARTER_HTML}
        />
      </section>
    </>
  );
}
