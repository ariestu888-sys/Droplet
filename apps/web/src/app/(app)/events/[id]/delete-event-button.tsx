"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "@/components/icons";
import { deleteEvent } from "./actions";

// Asks to confirm before deleting, since it can't be undone.
export function DeleteEventButton({
  eventId,
  organizationId,
  eventName,
  compact = false,
}: {
  eventId: string;
  organizationId: string;
  eventName: string;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the organization's page.
      const result = await deleteEvent(eventId, organizationId);
      if (result?.error) setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`dr-btn-secondary text-sm text-[#b8321f] hover:border-coral ${compact ? "px-4 py-2.5" : "px-5 py-2.5"}`}
      >
        <TrashIcon size={16} />
        Delete
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={`Delete ${eventName}?`} className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-sm font-semibold text-ink">Delete this event?</span>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={pending}
          autoFocus
          className="dr-btn-primary bg-[#c2341f] px-4 py-2.5 text-sm shadow-none hover:shadow-none disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="dr-btn-ghost px-3 py-2.5 text-sm">
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-[#b8321f]">
          {error}
        </p>
      )}
    </div>
  );
}
