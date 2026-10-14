import { AppShell } from "@/components/app-shell/app-shell";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
