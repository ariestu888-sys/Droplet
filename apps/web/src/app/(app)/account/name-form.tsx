"use client";

import { useActionState } from "react";
import { FormNotice } from "@/components/auth/auth-shell";
import { updateName, type NameFormState } from "./actions";

export function NameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState<NameFormState, FormData>(
    updateName,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label className="dr-field-label" htmlFor="fullName">Display name</label>
        <div className="flex gap-2">
          <input
            className="dr-input"
            id="fullName"
            name="fullName"
            type="text"
            defaultValue={state.name ?? initialName}
            placeholder="Jamie Rivera"
            autoComplete="name"
            maxLength={100}
            required
          />
          <button type="submit" disabled={pending} className="dr-btn-primary shrink-0 px-5 py-3 disabled:cursor-wait disabled:opacity-70">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <FormNotice state={state} />
    </form>
  );
}
