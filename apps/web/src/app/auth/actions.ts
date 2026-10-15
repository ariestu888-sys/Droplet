"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
};

// Where to send people after they sign in: the form's "next" page (e.g. an
// invitation they were accepting), if it's on this site, else Home.
const afterAuthPath = (formData?: FormData) => safeNextPath(String(formData?.get("next") ?? "") || null, "/home");

const callbackUrl = async (next: string) => `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;

async function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Please fill in your name, email and password." };
  }
  if (password.length < 8) {
    return { error: "Your password needs at least 8 characters." };
  }

  const next = afterAuthPath(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: await callbackUrl(next),
    },
  });

  if (error) return { error: error.message };

  // Supabase hides whether an email is taken: an existing address comes back
  // as a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Try logging in." };
  }

  // Email confirmation turned off in Supabase: the user is signed in already.
  if (data.session) redirect(next);

  return {
    message: `Almost there! We sent a confirmation link to ${email}. Open it to finish creating your account.`,
  };
}

export async function logIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first. Check your inbox for the link."
          : "That email and password don't match an account.",
    };
  }

  redirect(afterAuthPath(formData));
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: await callbackUrl(afterAuthPath(formData)),
      // Always show Google's account chooser, so people signed in to Google
      // see which account they're using instead of being signed in silently.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/auth/error");

  redirect(data.url);
}

// With a "next" page in the form (e.g. an invitation), goes to log in and
// returns there afterwards; otherwise to the public home page.
export async function signOut(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = formData?.get("next");
  redirect(next ? `/login?next=${encodeURIComponent(safeNextPath(String(next)))}` : "/");
}
