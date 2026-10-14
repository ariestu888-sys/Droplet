import type { Metadata } from "next";
import { AuthShell, OrDivider, TextLink } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { LogInForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in · Droplet" };

export default function LogInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see the events you follow."
      footer={<>New to Droplet? <TextLink href="/signup">Create an account</TextLink></>}
    >
      <LogInForm />
      <OrDivider />
      <GoogleButton />
    </AuthShell>
  );
}
