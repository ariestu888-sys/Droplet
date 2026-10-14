import Link from "next/link";
import { DropletLogo } from "@/components/droplet-logo";

// Page frame for the sign-up and log-in screens: sky background with the
// brand's soft circles, the logo, and a white card.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center overflow-x-hidden bg-sky px-4 pt-12 pb-14">
      <div aria-hidden className="absolute top-15 right-[4%] size-35 rounded-full bg-coral opacity-[0.08]" />
      <div aria-hidden className="absolute bottom-8 left-[3%] size-25 rounded-full bg-droplet opacity-[0.08]" />
      <div aria-hidden className="absolute top-35 left-[10%] size-3 rounded-full bg-spark opacity-60" />
      <div aria-hidden className="absolute right-[8%] bottom-30 size-2.5 rounded-full bg-droplet opacity-50" />

      <div className="relative z-10 flex w-full max-w-[460px] flex-col items-center">
        <Link href="/" className="mb-7" aria-label="Droplet home">
          <DropletLogo />
        </Link>

        <main className="w-full rounded-sheet border-2 border-line-soft bg-surface p-8 shadow-sheet max-sm:p-6">
          <h1 className="mb-1.5 text-[23px] font-bold tracking-[-0.01em]">{title}</h1>
          {subtitle && (
            <p className="mb-6 text-sm leading-[1.55] text-body">{subtitle}</p>
          )}
          {children}
        </main>

        {footer && <p className="mt-5 text-[13.5px] text-muted">{footer}</p>}
      </div>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-bold text-droplet hover:underline">
      {children}
    </Link>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-bold tracking-[0.04em] text-subtle uppercase">
      <span className="h-0.5 flex-1 bg-divider" />
      or
      <span className="h-0.5 flex-1 bg-divider" />
    </div>
  );
}

export function FormNotice({ state }: { state: { error?: string; message?: string } }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-field bg-success-tint px-4 py-3 text-sm font-semibold text-[#11743a]">
        {state.message}
      </p>
    );
  }
  return null;
}
