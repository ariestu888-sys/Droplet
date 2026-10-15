"use client";

import { useState, useTransition } from "react";
import { ROLE_LABELS } from "@droplet/shared";
import { BellIcon } from "@/components/icons";
import { subscribe, type SubscribeState } from "./actions";

// "Subscribe for updates" on an organization's splash page.
export function SubscribeButton({ organizationId, slug, organizationName }: { organizationId: string; slug: string; organizationName: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SubscribeState>({});

  if (state.role) {
    const label = ROLE_LABELS[state.role].toLowerCase();
    return (
      <p role="status" className="dr-badge bg-surface px-4 py-2.5 text-sm text-ink-soft">
        <BellIcon size={15} />
        {state.role === "subscriber"
          ? `You're subscribed to ${organizationName}'s updates.`
          : `You're already ${/^[aeiou]/.test(label) ? "an" : "a"} ${label} of ${organizationName}.`}
      </p>
    );
  }

  return (
    <span className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        // Signed-out visitors are sent to log in and brought back.
        onClick={() => startTransition(async () => setState(await subscribe(organizationId, slug)))}
        className="dr-btn-primary px-5 py-2.5 text-sm disabled:cursor-wait disabled:opacity-70"
      >
        <BellIcon size={16} />
        {pending ? "Subscribing…" : "Subscribe for updates"}
      </button>
      {state.error && <span role="alert" className="text-xs font-semibold text-[#b8321f]">{state.error}</span>}
    </span>
  );
}
