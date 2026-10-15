"use client";

import { useState, useTransition } from "react";
import { leaveOrganization } from "./actions";

// Asks to confirm before leaving.
export function LeaveOrganizationButton({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm font-semibold text-muted hover:text-[#b8321f] hover:underline">
        Leave organization
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={`Leave ${organizationName}?`} className="dr-card flex flex-col gap-3 border-coral-tint p-4">
      <p className="text-sm text-ink">
        Leave <strong>{organizationName}</strong>? You&apos;ll stop seeing its events and updates. To come back, you&apos;ll
        need a new invitation (or subscribe again from its splash page).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          autoFocus
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              // On success the action redirects to Home.
              const result = await leaveOrganization(organizationId);
              if (result?.error) setError(result.error);
            })
          }
          className="dr-btn-primary bg-[#c2341f] px-4 py-2.5 text-sm shadow-none hover:shadow-none disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Leaving…" : "Yes, leave"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="dr-btn-ghost px-3 py-2.5 text-sm">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[#b8321f]">{error}</p>}
    </div>
  );
}
