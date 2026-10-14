"use client";

import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/auth/actions";
import { FormNotice } from "./auth-shell";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signUp,
    {},
  );

  if (state.message) return <FormNotice state={state} />;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="dr-field-label" htmlFor="fullName">Full name</label>
        <input className="dr-input" id="fullName" name="fullName" type="text" placeholder="Jamie Rivera" autoComplete="name" required />
      </div>
      <div>
        <label className="dr-field-label" htmlFor="email">Email address</label>
        <input className="dr-input" id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div>
        <label className="dr-field-label" htmlFor="password">
          Password <span className="font-normal text-subtle">(at least 8 characters)</span>
        </label>
        <input className="dr-input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>

      <FormNotice state={state} />

      <button type="submit" disabled={pending} className="dr-btn-primary w-full py-[15px] disabled:cursor-wait disabled:opacity-70">
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}
