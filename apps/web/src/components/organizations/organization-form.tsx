"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LOGO_MAX_BYTES, LOGO_TYPES, type OrganizationType } from "@droplet/shared";
import { FormNotice } from "@/components/auth/auth-shell";
import { FormField, FormSection, TypePicker } from "@/components/forms/form-fields";
import type { OrganizationFormState, OrganizationFormValues } from "@/lib/organization-form";

// The organization form, used to create and to edit. `action` is a server
// action that receives the form data.
export function OrganizationForm({
  action,
  types,
  initial = {},
  currentLogoUrl = null,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: (state: OrganizationFormState, formData: FormData) => Promise<OrganizationFormState>;
  types: OrganizationType[];
  initial?: OrganizationFormValues;
  currentLogoUrl?: string | null;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormSection title="Basics">
        <FormField name="name" label="Organization name" error={errors.name}>
          {(props) => (
            <input {...props} type="text" placeholder="Northfield Esports Club" maxLength={80} required defaultValue={values.name} />
          )}
        </FormField>

        <TypePicker
          types={types}
          defaultType={values.type}
          defaultCustomType={values.customType}
          error={errors.type}
          customPlaceholder="e.g. Robotics team"
        />

        <FormField name="description" label="Description" optional error={errors.description}>
          {(props) => (
            <textarea
              {...props}
              placeholder="What does your organization do? Members will see this."
              maxLength={500}
              defaultValue={values.description}
              className={`${props.className} min-h-24 resize-y leading-normal`}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection title="Location">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 max-sm:grid-cols-1">
          <FormField name="address" label="Address" optional error={errors.address}>
            {(props) => (
              <input {...props} type="text" placeholder="1200 Cedar Ave, Riverton" maxLength={200} autoComplete="street-address" defaultValue={values.address} />
            )}
          </FormField>
          <FormField name="zipcode" label="ZIP code" optional error={errors.zipcode}>
            {(props) => (
              <input {...props} type="text" inputMode="numeric" placeholder="60201" maxLength={10} autoComplete="postal-code" defaultValue={values.zipcode} />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Links">
        <FormField name="websiteUrl" label="Website" optional error={errors.websiteUrl}>
          {(props) => (
            <input {...props} type="url" placeholder="https://northfieldesports.com" maxLength={300} defaultValue={values.websiteUrl} />
          )}
        </FormField>
        <FormField name="discordUrl" label="Discord invite link" optional error={errors.discordUrl}>
          {(props) => (
            <input {...props} type="url" placeholder="https://discord.gg/abc123" maxLength={200} defaultValue={values.discordUrl} />
          )}
        </FormField>
      </FormSection>

      <FormSection title="Logo">
        <LogoPicker currentLogoUrl={currentLogoUrl} error={errors.logo} />
      </FormSection>

      <FormNotice state={{ error: state.error }} />

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="dr-btn-primary disabled:cursor-wait disabled:opacity-70">
          {pending ? pendingLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="dr-btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}

// Pick a new logo (with preview), or remove the current one.
function LogoPicker({ currentLogoUrl, error }: { currentLogoUrl: string | null; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeCurrent, setRemoveCurrent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLocalError(null);
    setPreview(null);
    if (!file) return;
    if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
      setLocalError("Logos must be PNG, JPG or WebP images.");
      e.target.value = "";
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLocalError("Logos can be up to 2 MB.");
      e.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
    setRemoveCurrent(false);
  }

  function clearPicked() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
  }

  const shown = preview ?? (removeCurrent ? null : currentLogoUrl);
  const shownError = localError ?? error;

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-line bg-canvas">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- picked file preview or Supabase Storage logo
          <img src={shown} alt={preview ? "New logo preview" : "Current logo"} className="size-full object-cover" />
        ) : (
          <span className="text-xs text-subtle">No logo</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <label htmlFor="logo" className="dr-btn-secondary cursor-pointer px-4 py-2 text-sm">
            {shown ? "Choose another" : "Choose image"}
          </label>
          {preview && (
            <button type="button" onClick={clearPicked} className="dr-btn-ghost px-3 py-2 text-sm">
              {currentLogoUrl ? "Keep current" : "Remove"}
            </button>
          )}
          {!preview && currentLogoUrl && (
            <button type="button" onClick={() => setRemoveCurrent((r) => !r)} className="dr-btn-ghost px-3 py-2 text-sm">
              {removeCurrent ? "Undo remove" : "Remove logo"}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          id="logo"
          name="logo"
          type="file"
          accept={LOGO_TYPES.join(",")}
          onChange={onChange}
          className="sr-only"
          aria-describedby={shownError ? "logo-hint logo-error" : "logo-hint"}
        />
        {removeCurrent && <input type="hidden" name="removeLogo" value="1" />}
        <p id="logo-hint" className="mt-1.5 text-xs text-subtle">
          {removeCurrent ? "The logo will be removed when you save." : "Optional. PNG, JPG or WebP, up to 2 MB. Square images look best."}
        </p>
        {shownError && <p id="logo-error" className="mt-1 text-xs font-semibold text-[#b8321f]">{shownError}</p>}
      </div>
    </div>
  );
}
