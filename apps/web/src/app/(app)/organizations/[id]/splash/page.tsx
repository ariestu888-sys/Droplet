import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DropletApiError, isOrganizer, type Organization, type Sponsor, type SplashContent } from "@droplet/shared";
import { PageHeader } from "@/components/app-shell/app-shell";
import { createServerApi } from "@/lib/api/server";
import { isUuid } from "@/lib/uuid";
import { SplashContentEditor } from "@/components/splash/splash-content-editor";
import { saveSplashContent } from "./actions";
import { SplashColorsForm } from "./splash-colors-form";
import { SponsorsManager } from "./splash-editor";

export const metadata: Metadata = { title: "Edit splash page · Droplet" };

export default function EditSplashPage({ params }: PageProps<"/organizations/[id]/splash">) {
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
  let org: Organization;
  let content: SplashContent;
  let sponsors: Sponsor[];
  try {
    [org, content, { data: sponsors }] = await Promise.all([
      api.organizations.get(id),
      api.splash.get(id),
      api.sponsors.list(id),
    ]);
  } catch (err) {
    if (err instanceof DropletApiError && err.status === 401) redirect("/login");
    if (err instanceof DropletApiError && err.status === 404) notFound();
    const notSetUp = err instanceof DropletApiError && err.code === "not_set_up";
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {notSetUp
          ? "Splash pages aren't set up in the database yet. Run the latest migration in supabase/migrations."
          : "Couldn't load the splash page editor. Is the Droplet API running?"}
      </p>
    );
  }

  const back = (
    <Link href={`/organizations/${org.id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
      <span aria-hidden>←</span> {org.name}
    </Link>
  );

  if (!isOrganizer(org.role)) {
    return (
      <>
        {back}
        <PageHeader title="Splash page" />
        <p className="dr-card text-sm text-body">
          Only organizers can edit the splash page.{" "}
          <Link href={`/o/${org.slug}`} className="font-semibold text-[#0369a1] hover:underline">
            View it
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      {back}
      <PageHeader
        title="Splash page"
        subtitle="A public page anyone can see, no sign-in needed. Share its link anywhere."
        actions={
          <a href={`/o/${org.slug}`} target="_blank" rel="noopener" className="dr-btn-secondary px-5 py-2.5 text-sm">
            View page ↗
          </a>
        }
      />

      <div className="flex flex-col gap-4">
        <section aria-labelledby="content-heading" className="dr-card">
          <h2 id="content-heading" className="mb-1 text-base font-bold">Splash content</h2>
          <p className="mb-4 text-sm text-muted">
            Shown under your logo and name. Upcoming public events appear below it automatically.
          </p>
          <SplashContentEditor action={saveSplashContent.bind(null, org.id)} initialHtml={content.html ?? ""} />
        </section>

        <section aria-labelledby="colors-heading" className="dr-card">
          <h2 id="colors-heading" className="mb-1 text-base font-bold">Colors</h2>
          <p className="mb-4 text-sm text-muted">
            Brand your splash page and your events&apos; splash pages. Text stays readable whatever you pick.
          </p>
          <SplashColorsForm
            organizationId={org.id}
            primaryColor={org.splashPrimaryColor}
            secondaryColor={org.splashSecondaryColor}
            canEdit={org.role === "owner"}
          />
        </section>

        <section aria-labelledby="sponsors-heading" className="dr-card">
          <h2 id="sponsors-heading" className="mb-1 text-base font-bold">Sponsors</h2>
          <p className="mb-4 text-sm text-muted">Shown in the page&apos;s footer, with links to their websites.</p>
          <SponsorsManager organizationId={org.id} sponsors={sponsors} />
        </section>
      </div>
    </>
  );
}
