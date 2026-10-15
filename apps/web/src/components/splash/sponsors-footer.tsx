import Link from "next/link";
import type { Sponsor } from "@droplet/shared";
import { DropletLogo } from "@/components/droplet-logo";

// Footer for public splash pages: the organization's sponsors, then a small
// "Powered by Droplet".
export function SponsorsFooter({ organizationName, sponsors }: { organizationName: string; sponsors: Sponsor[] }) {
  return (
    <footer className="border-t-2 border-line-soft bg-canvas">
      {sponsors.length > 0 && (
        <section aria-labelledby="sponsors-heading" className="mx-auto w-full max-w-[1120px] px-6 pt-10 pb-6 max-sm:px-4">
          <h2 id="sponsors-heading" className="mb-1 text-center text-xl font-bold">Thank you to our sponsors</h2>
          <p className="mb-6 text-center text-sm text-muted">{organizationName} is made possible by</p>
          <ul className="flex flex-wrap items-stretch justify-center gap-3">
            {sponsors.map((sponsor) => {
              const content = (
                <>
                  {sponsor.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logos come from Supabase Storage
                    <img src={sponsor.logoUrl} alt="" className="h-14 w-auto max-w-[160px] object-contain" />
                  ) : (
                    <span aria-hidden className="flex size-14 items-center justify-center rounded-field bg-coral-tint font-display text-xl font-bold text-coral">
                      {sponsor.name[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-ink-soft">{sponsor.name}</span>
                </>
              );
              const box =
                "flex min-w-[150px] flex-col items-center gap-2 rounded-card border-2 border-line-soft bg-surface px-5 py-4 text-center";
              return (
                <li key={sponsor.id}>
                  {sponsor.websiteUrl ? (
                    <a
                      href={sponsor.websiteUrl}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className={`${box} transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-card-hover`}
                    >
                      {content}
                    </a>
                  ) : (
                    <div className={box}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="flex items-center justify-center gap-2 px-6 py-6 text-xs text-subtle">
        Powered by
        <Link href="/" className="text-ink hover:opacity-80" aria-label="Droplet">
          <DropletLogo size={18} />
        </Link>
      </div>
    </footer>
  );
}
