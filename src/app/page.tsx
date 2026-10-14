import { connection } from "next/server";
import { Suspense } from "react";

async function SupabaseStatus() {
  // Check on every request rather than once at build time.
  await connection();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let ok = false;
  let message: string;

  if (!url || !key || url.includes("your-project-ref")) {
    message = "Supabase URL not set in .env.local";
  } else {
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
      });
      ok = res.ok;
      message = res.ok
        ? "Connected to Supabase"
        : `Supabase responded with ${res.status}`;
    } catch {
      message = "Could not reach Supabase";
    }
  }

  return <StatusPill ok={ok} message={message} />;
}

function StatusPill({ ok, message }: { ok?: boolean; message: string }) {
  const dot =
    ok === undefined ? "bg-zinc-400" : ok ? "bg-emerald-500" : "bg-amber-500";

  return (
    <p className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-1.5 text-sm dark:border-white/15">
      <span className={`size-2 rounded-full ${dot}`} />
      {message}
    </p>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">Droplet</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Your new site is up and running.
      </p>
      <Suspense fallback={<StatusPill message="Checking Supabase…" />}>
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}
