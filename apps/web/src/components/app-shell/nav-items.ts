// The signed-in menu, in order. "Create Organization" comes first.
export type NavItem = {
  href: string;
  label: string;
  icon: "create-organization" | "home" | "account";
};

export const MAIN_NAV: NavItem[] = [
  { href: "/organizations/new", label: "Create Organization", icon: "create-organization" },
  { href: "/home", label: "Home", icon: "home" },
];

export const ACCOUNT_NAV: NavItem = { href: "/account", label: "Account", icon: "account" };
