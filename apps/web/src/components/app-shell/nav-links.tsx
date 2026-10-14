"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BuildingPlusIcon, HomeIcon, UserIcon } from "@/components/icons";
import type { NavItem } from "./nav-items";

const ICONS = {
  "create-organization": BuildingPlusIcon,
  home: HomeIcon,
  account: UserIcon,
} satisfies Record<NavItem["icon"], unknown>;

type NavLinkProps = { item: NavItem; variant: "sidebar" | "topbar" };

// The current URL is request-time data on dynamic routes, so it's read inside
// Suspense; until then the link shows as not active.
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink(props: NavLinkProps) {
  const pathname = usePathname();
  return <NavLinkView {...props} active={pathname === props.item.href} />;
}

function NavLinkView({ item, variant, active }: NavLinkProps & { active: boolean }) {
  const Icon = ICONS[item.icon];

  if (variant === "topbar") {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
          active ? "bg-navy-hover text-white" : "text-navy-muted hover:bg-navy-hover hover:text-white"
        }`}
      >
        <Icon size={16} />
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-field px-3.5 py-[11px] text-[14.5px] font-semibold transition-colors ${
        active ? "bg-navy-hover text-white" : "text-navy-muted hover:bg-navy-hover hover:text-white"
      }`}
    >
      {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3.5 w-[3px] rounded-sm bg-droplet" />}
      <Icon />
      {item.label}
    </Link>
  );
}
