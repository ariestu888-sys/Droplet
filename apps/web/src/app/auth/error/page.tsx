import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, TextLink } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign-in problem · Droplet" };

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="That link didn't work"
      subtitle="Your sign-in or confirmation link may have expired or already been used, or it was opened in a different browser from the one you signed up in."
      footer={<>Need a new account? <TextLink href="/signup">Sign up</TextLink></>}
    >
      <Link href="/login" className="dr-btn-primary w-full py-[15px]">
        Back to log in
      </Link>
    </AuthShell>
  );
}
