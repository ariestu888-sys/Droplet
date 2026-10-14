"use client";

import { useState } from "react";
import { CUSTOM_TYPE } from "@/lib/form-constants";

// Building blocks shared by Droplet's forms.

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t-2 border-divider pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-4 font-display text-base font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

export type FieldInputProps = {
  id: string;
  name: string;
  className: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

// A labelled input with an optional hint and error. `children` renders the
// control, given the props that wire it to the label and messages.
export function FormField({
  name,
  label,
  optional,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (props: FieldInputProps) => React.ReactNode;
}) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label className="dr-field-label" htmlFor={name}>
        {label} {optional && <span className="font-normal text-subtle">(optional)</span>}
      </label>
      {children({
        id: name,
        name,
        className: `dr-input ${error ? "border-coral" : ""}`,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && <p id={`${name}-hint`} className="mt-1.5 text-xs text-subtle">{hint}</p>}
      {error && <p id={`${name}-error`} className="mt-1.5 text-xs font-semibold text-[#b8321f]">{error}</p>}
    </div>
  );
}

// A type dropdown: the starter list, custom types others added, and an
// "add your own" option that reveals a text box (submitted as `customType`).
export function TypePicker({
  types,
  defaultType = "",
  defaultCustomType = "",
  error,
  customPlaceholder,
}: {
  types: { id: number; name: string; isPreset: boolean }[];
  defaultType?: string;
  defaultCustomType?: string;
  error?: string;
  customPlaceholder: string;
}) {
  const [choice, setChoice] = useState(defaultType);
  const presets = types.filter((t) => t.isPreset);
  const custom = types.filter((t) => !t.isPreset);

  return (
    <>
      <FormField name="type" label="Type" error={error}>
        {(props) => (
          <select
            {...props}
            required
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={`${props.className} cursor-pointer`}
          >
            <option value="" disabled>
              Choose a type…
            </option>
            <optgroup label="Common types">
              {presets.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
            {custom.length > 0 && (
              <optgroup label="Added by Droplet organizers">
                {custom.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </optgroup>
            )}
            <option value={CUSTOM_TYPE}>+ Add your own type…</option>
          </select>
        )}
      </FormField>

      {choice === CUSTOM_TYPE && (
        <FormField name="customType" label="Your type" hint="It'll be added to the list for next time." error={error}>
          {(props) => (
            <input {...props} type="text" placeholder={customPlaceholder} maxLength={40} required autoFocus defaultValue={defaultCustomType} />
          )}
        </FormField>
      )}
    </>
  );
}
