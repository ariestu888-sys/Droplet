import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { DropletLogo } from "@/components/droplet-logo";
import { LogOutIcon } from "@/components/icons";
import { createServerApi } from "@/lib/api/server";
import { ACCOUNT_NAV, MAIN_NAV } from "./nav-items";
import { NavLink } from "./nav-links";

// Frame for signed-in pages: navy sidebar menu on wide screens, a top menu
// bar on narrow ones (as in the "Organizer dashboard" design).
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 bg-canvas max-lg:flex-col">
      {/* Sidebar (wide screens) */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-navy px-3.5 py-5 max-lg:hidden">
        <Link href="/home" className="px-2 pt-1.5 pb-6 text-white" aria-label="Droplet home">
          <DropletLogo size={26} />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} variant="sidebar" />
          ))}
        </nav>
        <div className="grow" />
        <nav aria-label="Account" className="mb-2 flex flex-col gap-0.5">
          <NavLink item={ACCOUNT_NAV} variant="sidebar" />
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-3 rounded-field px-3.5 py-[11px] text-[14.5px] font-semibold text-navy-muted transition-colors hover:bg-navy-hover hover:text-white"
            >
              <LogOutIcon />
              Log out
            </button>
          </form>
        </nav>
        <Suspense fallback={<UserChipFrame name="…" />}>
          <UserChip />
        </Suspense>
      </aside>

      {/* Top menu bar (narrow screens) */}
      <header className="sticky top-0 z-20 bg-navy lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <Link href="/home" className="text-white" aria-label="Droplet home">
            <DropletLogo size={24} />
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy-muted hover:text-white">
              <LogOutIcon size={16} />
              Log out
            </button>
          </form>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 py-2.5">
          {[...MAIN_NAV, ACCOUNT_NAV].map((item) => (
            <NavLink key={item.href} item={item} variant="topbar" />
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-9 pt-8 pb-12 max-lg:px-4 max-lg:pt-6">{children}</main>
    </div>
  );
}

async function UserChip() {
  await connection();
  const profile = await (await createServerApi()).me.get().catch(() => null);
  const name = profile?.fullName || profile?.email || "Signed in";
  return <UserChipFrame name={name} email={profile?.fullName ? profile.email : null} />;
}

function UserChipFrame({ name, email }: { name: string; email?: string | null }) {
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="flex items-center gap-2.5 rounded-field bg-navy-hover p-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral text-[13px] font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-bold text-white">{name}</div>
        {email && <div className="truncate text-xs text-navy-muted">{email}</div>}
      </div>
    </div>
  );
}

// Page heading row, as in the design's top bar.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="mb-1 text-[25px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
