"use client";

import { useActionState, useState, useTransition } from "react";
import { LOGO_TYPES, type Sponsor } from "@droplet/shared";
import { FormNotice } from "@/components/auth/auth-shell";
import { FormField } from "@/components/forms/form-fields";
import { TrashIcon } from "@/components/icons";
import {
  addSponsor,
  removeSponsor,
  type SponsorFormState,
} from "./actions";

export function SponsorsManager({ organizationId, sponsors }: { organizationId: string; sponsors: Sponsor[] }) {
  const [state, formAction, pending] = useActionState<SponsorFormState, FormData>(
    addSponsor.bind(null, organizationId),
    {},
  );

  return (
    <div className="flex flex-col gap-5">
      {sponsors.length === 0 ? (
        <p className="rounded-field border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No sponsors yet. Sponsors you add appear in the splash page&apos;s footer.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sponsors.map((sponsor) => (
            <SponsorRow key={sponsor.id} sponsor={sponsor} />
          ))}
        </ul>
      )}

      <form
        action={formAction}
        // Clear the form after a successful add.
        key={state.message ?? "add"}
        className="flex flex-col gap-4 rounded-field border-2 border-line-soft p-4"
        noValidate
      >
        <p className="font-display font-bold">Add a sponsor</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="name" label="Name">
            {(props) => <input {...props} type="text" placeholder="Riverton Pizza Co." maxLength={100} required />}
          </FormField>
          <FormField name="websiteUrl" label="Website" optional>
            {(props) => <input {...props} type="url" placeholder="https://rivertonpizza.com" maxLength={300} />}
          </FormField>
        </div>
        <FormField name="logo" label="Logo" optional hint="PNG, JPG or WebP, up to 2 MB.">
          {(props) => (
            <input
              {...props}
              type="file"
              accept={LOGO_TYPES.join(",")}
              className={`${props.className} cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-droplet-tint file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-[#0369a1]`}
            />
          )}
        </FormField>
        <FormNotice state={state} />
        <div>
          <button type="submit" disabled={pending} className="dr-btn-secondary px-5 py-2.5 text-sm disabled:cursor-wait disabled:opacity-70">
            {pending ? "Adding…" : "Add sponsor"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex items-center gap-3 rounded-field border-2 border-line-soft p-3">
      {sponsor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from Supabase Storage
        <img src={sponsor.logoUrl} alt="" className="h-10 w-16 shrink-0 object-contain" />
      ) : (
        <span aria-hidden className="flex h-10 w-16 shrink-0 items-center justify-center rounded-field bg-coral-tint font-display font-bold text-coral">
          {sponsor.name[0]?.toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{sponsor.name}</p>
        {sponsor.websiteUrl && <p className="truncate text-xs text-subtle">{sponsor.websiteUrl.replace(/^https?:\/\//, "")}</p>}
        {error && <p role="alert" className="text-xs font-semibold text-[#b8321f]">{error}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${sponsor.name}`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await removeSponsor(sponsor.id);
            if (result.error) setError(result.error);
          })
        }
        className="dr-btn-ghost px-3 py-2 text-sm text-[#b8321f] disabled:opacity-60"
      >
        <TrashIcon size={16} />
        {pending ? "Removing…" : "Remove"}
      </button>
    </li>
  );
}
