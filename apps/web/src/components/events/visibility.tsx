import type { EventVisibility } from "@droplet/shared";
import { EyeOffIcon, GlobeIcon, LockIcon } from "@/components/icons";

const ICONS = { public: GlobeIcon, private: LockIcon, hidden: EyeOffIcon };

export function VisibilityIcon({ visibility, size = 15 }: { visibility: EventVisibility; size?: number }) {
  const Icon = ICONS[visibility];
  return <Icon size={size} />;
}

const BADGES: Record<EventVisibility, { label: string; className: string; title: string }> = {
  public: {
    label: "Public",
    className: "bg-success-tint text-[#11743a]",
    title: "All members can see it and sign up",
  },
  private: {
    label: "Private",
    className: "bg-[#fff7e0] text-[#8a5a00]",
    title: "Members can see it; sign-up is by invitation",
  },
  hidden: {
    label: "Hidden",
    className: "bg-divider text-ink-soft",
    title: "Only organizers can see it",
  },
};

export function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const badge = BADGES[visibility];
  return (
    <span className={`dr-badge shrink-0 ${badge.className}`} title={badge.title}>
      <VisibilityIcon visibility={visibility} size={13} />
      {badge.label}
    </span>
  );
}
