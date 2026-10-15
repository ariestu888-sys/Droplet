import { siDiscord, siInstagram, type SimpleIcon } from "simple-icons";

// Round brand-icon links to an organization's social accounts, for the top
// right of a splash page banner. Shows only the accounts it has.

const SOCIALS: { key: "discordUrl" | "instagramUrl"; icon: SimpleIcon; label: string; background: string }[] = [
  { key: "discordUrl", icon: siDiscord, label: "Discord", background: `#${siDiscord.hex}` },
  {
    key: "instagramUrl",
    icon: siInstagram,
    label: "Instagram",
    // Instagram's gradient.
    background: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
  },
];

export function SocialLinks({
  organizationName,
  links,
  className = "",
}: {
  organizationName: string;
  links: { discordUrl?: string | null; instagramUrl?: string | null };
  className?: string;
}) {
  const present = SOCIALS.filter((s) => links[s.key]);
  if (present.length === 0) return null;

  return (
    <nav aria-label={`${organizationName} on social media`} className={className}>
      <ul className="flex gap-2">
        {present.map(({ key, icon, label, background }) => (
          <li key={key}>
            <a
              href={links[key]!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${organizationName} on ${label}`}
              title={label}
              style={{ background }}
              className="flex size-11 items-center justify-center rounded-full text-white shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)] transition-transform duration-150 hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <svg role="img" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d={icon.path} />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
