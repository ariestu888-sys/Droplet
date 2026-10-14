import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createDropletApi } from "@droplet/shared";
import { DropletLogo } from "@/components/droplet-logo";

// Website -> API -> Supabase: checks all three tiers are talking.
async function SystemStatus() {
  // Check on every request rather than once at build time.
  await connection();

  let ok = false;
  let message: string;
  try {
    const health = await createDropletApi({ baseUrl: process.env.NEXT_PUBLIC_API_URL! }).health();
    ok = health.services.supabase === "up";
    message = ok ? "API and Supabase connected" : "API is up, but can't reach Supabase";
  } catch {
    message = "Can't reach the Droplet API";
  }

  return <StatusPill ok={ok} message={message} />;
}

function StatusPill({ ok, message }: { ok?: boolean; message: string }) {
  const dot =
    ok === undefined ? "bg-subtle" : ok ? "bg-success" : "bg-coral";

  return (
    <p className="dr-badge border-2 border-line-soft bg-surface text-ink-soft">
      <span className={`dr-live-dot ${dot}`} />
      {message}
    </p>
  );
}

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-sky px-4 text-center">
      <div aria-hidden className="absolute top-16 right-[4%] size-36 rounded-full bg-coral opacity-[0.08]" />
      <div aria-hidden className="absolute bottom-8 left-[3%] size-24 rounded-full bg-droplet opacity-[0.08]" />
      <div aria-hidden className="absolute top-36 left-[10%] size-3 rounded-full bg-spark opacity-60" />

      <DropletLogo size={56} showWordmark={false} />
      <h1 className="text-5xl font-bold tracking-tight">Droplet</h1>
      <p className="max-w-md text-lg text-body">
        Your new site is up and running.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/signup" className="dr-btn-primary">Create an account</Link>
        <Link href="/login" className="dr-btn-secondary">Log in</Link>
      </div>
      <Suspense fallback={<StatusPill message="Checking connection…" />}>
        <SystemStatus />
      </Suspense>
    </main>
  );
}
