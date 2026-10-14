import type { Metadata } from "next";
import { AuthShell, OrDivider, TextLink } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account · Droplet" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your Droplet account"
      subtitle="Follow events, get live updates, and never miss a result."
      footer={<>Already have an account? <TextLink href="/login">Log in</TextLink></>}
    >
      <SignUpForm />
      <OrDivider />
      <GoogleButton label="Sign up with Google" />
      <p className="mt-4 text-center text-xs leading-normal text-subtle">
        By continuing you agree to Droplet&apos;s Terms and Privacy Policy.
      </p>
    </AuthShell>
  );
}
