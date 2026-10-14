"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { EventType, EventVisibility } from "@droplet/shared";
import { FormNotice } from "@/components/auth/auth-shell";
import { VisibilityIcon } from "@/components/events/visibility";
import { FormField, FormSection, TypePicker } from "@/components/forms/form-fields";
import type { EventFormState, EventFormValues } from "@/lib/event-form";

export function EventForm({
  action,
  initial = {},
  types,
  countries,
  timeZones,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  /** Starting values, e.g. the event being edited. */
  initial?: EventFormValues;
  types: EventType[];
  /** [code, name] pairs, sorted by name. */
  countries: [string, string][];
  timeZones: string[];
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
        <FormField name="name" label="Event name" error={errors.name}>
          {(props) => (
            <input {...props} type="text" placeholder="Autumn Invitational" maxLength={120} required defaultValue={values.name} />
          )}
        </FormField>
        <TypePicker
          types={types}
          defaultType={values.type}
          defaultCustomType={values.customType}
          error={errors.type}
          customPlaceholder="e.g. Battle of the bands"
        />
      </FormSection>

      <FormSection title="Who can see it">
        <VisibilityPicker defaultValue={values.visibility} error={errors.visibility} />
      </FormSection>

      <FormSection title="When">
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <FormField name="startDate" label="Start date" error={errors.startDate}>
            {(props) => <input {...props} type="date" required defaultValue={values.startDate} />}
          </FormField>
          <FormField name="startTime" label="Start time" optional error={errors.startTime}>
            {(props) => <input {...props} type="text" placeholder="e.g. 9:00 AM" maxLength={12} defaultValue={values.startTime} />}
          </FormField>
          <FormField name="endDate" label="End date" error={errors.endDate}>
            {(props) => <input {...props} type="date" required defaultValue={values.endDate} />}
          </FormField>
          <FormField name="endTime" label="End time" optional error={errors.endTime}>
            {(props) => <input {...props} type="text" placeholder="e.g. 6:00 PM" maxLength={12} defaultValue={values.endTime} />}
          </FormField>
        </div>
        <p className="-mt-1 text-xs text-subtle">
          Leave a time blank for date-only. Type times however you like: 9am, 9:30 PM or 21:30.
        </p>
        <TimeZoneField timeZones={timeZones} defaultValue={values.timezone} error={errors.timezone} />
      </FormSection>

      <FormSection title="Where">
        <FormField name="address" label="Address" optional error={errors.address}>
          {(props) => (
            <input {...props} type="text" placeholder="Cedar Hall, 1200 Cedar Ave" maxLength={200} autoComplete="street-address" defaultValue={values.address} />
          )}
        </FormField>
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 max-sm:grid-cols-1">
          <FormField name="city" label="City" optional error={errors.city}>
            {(props) => (
              <input {...props} type="text" placeholder="Riverton" maxLength={100} autoComplete="address-level2" defaultValue={values.city} />
            )}
          </FormField>
          <FormField name="postalCode" label="ZIP / postal code" optional error={errors.postalCode}>
            {(props) => (
              <input {...props} type="text" placeholder="60201" maxLength={12} autoComplete="postal-code" defaultValue={values.postalCode} />
            )}
          </FormField>
        </div>
        <FormField name="country" label="Country" optional error={errors.country}>
          {(props) => (
            <select {...props} defaultValue={values.country ?? "US"} autoComplete="country" className={`${props.className} cursor-pointer`}>
              <option value="">Not set</option>
              {countries.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          )}
        </FormField>
      </FormSection>

      <FormSection title="More details">
        <FormField name="capacity" label="Capacity" optional hint="The most people who can attend." error={errors.capacity}>
          {(props) => (
            <input {...props} type="number" inputMode="numeric" min={1} max={1000000} step={1} placeholder="64" defaultValue={values.capacity} className={`${props.className} max-w-48`} />
          )}
        </FormField>
        <FormField name="websiteUrl" label="Website" optional error={errors.websiteUrl}>
          {(props) => (
            <input {...props} type="url" placeholder="https://northfieldesports.com/autumn" maxLength={300} defaultValue={values.websiteUrl} />
          )}
        </FormField>
        <FormField name="discordUrl" label="Discord invite link" optional error={errors.discordUrl}>
          {(props) => (
            <input {...props} type="url" placeholder="https://discord.gg/abc123" maxLength={200} defaultValue={values.discordUrl} />
          )}
        </FormField>
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

const VISIBILITY_OPTIONS: { value: EventVisibility; title: string; description: string }[] = [
  { value: "public", title: "Public", description: "All members of the organization can see it and sign up." },
  { value: "private", title: "Private", description: "Members can see it, but signing up is by invitation only." },
  { value: "hidden", title: "Hidden", description: "Only organizers (owners and admins) can see it. Use this while you're still planning." },
];

function VisibilityPicker({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  const selected = defaultValue || "public";
  return (
    <div role="radiogroup" aria-label="Visibility" aria-describedby={error ? "visibility-error" : undefined} className="grid gap-2.5 sm:grid-cols-3">
      {VISIBILITY_OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer flex-col gap-1 rounded-field border-2 border-line-soft p-3.5 transition-colors hover:border-droplet-tint-border has-checked:border-droplet has-checked:bg-droplet-tint has-focus-visible:border-droplet"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <input
              type="radio"
              name="visibility"
              value={option.value}
              defaultChecked={selected === option.value}
              className="size-4 accent-droplet"
            />
            <VisibilityIcon visibility={option.value} />
            {option.title}
          </span>
          <span className="text-[12.5px] leading-snug text-muted">{option.description}</span>
        </label>
      ))}
      {error && <p id="visibility-error" className="text-xs font-semibold text-[#b8321f] sm:col-span-3">{error}</p>}
    </div>
  );
}

// Defaults to the visitor's own time zone once the page is running in their
// browser (the server can't know it).
function TimeZoneField({
  timeZones,
  defaultValue,
  error,
}: {
  timeZones: string[];
  defaultValue?: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  useEffect(() => {
    if (value) return;
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's time zone after mount
    if (local && timeZones.includes(local)) setValue(local);
  }, [value, timeZones]);

  return (
    <FormField name="timezone" label="Time zone" hint="Start and end times are in this time zone." error={error}>
      {(props) => (
        <select {...props} required value={value} onChange={(e) => setValue(e.target.value)} className={`${props.className} cursor-pointer`}>
          <option value="" disabled>
            Choose a time zone…
          </option>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>{tz.replaceAll("_", " ")}</option>
          ))}
        </select>
      )}
    </FormField>
  );
}
