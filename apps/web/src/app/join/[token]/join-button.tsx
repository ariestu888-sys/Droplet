"use client";

import { useState, useTransition } from "react";
import { joinWithLink } from "./actions";

export function JoinButton({ token, organizationName }: { token: string; organizationName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // On success the action opens the organization's page.
            const result = await joinWithLink(token);
            if (result?.error) setError(result.error);
          })
        }
        className="dr-btn-primary w-full py-[15px] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Joining…" : `Join ${organizationName}`}
      </button>
      {error && (
        <p role="alert" className="rounded-field bg-coral-tint px-4 py-3 text-sm font-semibold text-[#b8321f]">
          {error}
        </p>
      )}
    </div>
  );
}
