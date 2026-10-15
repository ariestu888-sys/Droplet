"use client";

import { useActionState } from "react";
import { logIn, type AuthFormState } from "@/app/auth/actions";
import { FormNotice } from "./auth-shell";
import { NextField } from "./next-field";

export function LogInForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    logIn,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <NextField />
      <div>
        <label className="dr-field-label" htmlFor="email">Email address</label>
        <input className="dr-input" id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div>
        <label className="dr-field-label" htmlFor="password">Password</label>
        <input className="dr-input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <FormNotice state={state} />

      <button type="submit" disabled={pending} className="dr-btn-primary w-full py-[15px] disabled:cursor-wait disabled:opacity-70">
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
