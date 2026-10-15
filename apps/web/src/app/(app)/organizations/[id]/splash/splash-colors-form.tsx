"use client";

import { useActionState, useState } from "react";
import { FormNotice } from "@/components/auth/auth-shell";
import { splashThemeStyle } from "@/lib/splash-theme";
import { saveSplashColors, type SplashColorsState } from "./actions";

// Droplet's own colors, used when an organization hasn't chosen any.
const DEFAULT_PRIMARY = "#0ea5e9";
const DEFAULT_SECONDARY = "#ff6b57";

const HEX = /^#[0-9a-f]{6}$/i;

export function SplashColorsForm({
  organizationId,
  primaryColor,
  secondaryColor,
  canEdit,
}: {
  organizationId: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<SplashColorsState, FormData>(
    saveSplashColors.bind(null, organizationId),
    {},
  );
  const [primary, setPrimary] = useState(primaryColor ?? "");
  const [secondary, setSecondary] = useState(secondaryColor ?? "");

  const previewColors = {
    primaryColor: HEX.test(primary) ? primary.toLowerCase() : null,
    secondaryColor: HEX.test(secondary) ? secondary.toLowerCase() : null,
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {!canEdit && (
        <p className="rounded-field bg-divider px-4 py-3 text-sm text-ink-soft">
          Only the organization&apos;s owner can change these colors.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          name="primaryColor"
          label="Primary color"
          hint="Buttons, links, badges and the header."
          value={primary}
          fallback={DEFAULT_PRIMARY}
          onChange={setPrimary}
          disabled={!canEdit}
        />
        <ColorField
          name="secondaryColor"
          label="Secondary color"
          hint="Accents and decoration."
          value={secondary}
          fallback={DEFAULT_SECONDARY}
          onChange={setSecondary}
          disabled={!canEdit}
        />
      </div>

      <Preview colors={previewColors} />

      <FormNotice state={state} />

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className="dr-btn-primary disabled:cursor-wait disabled:opacity-70">
            {pending ? "Saving…" : "Save colors"}
          </button>
          {(primary || secondary) && (
            <button
              type="button"
              className="dr-btn-ghost"
              onClick={() => {
                setPrimary("");
                setSecondary("");
              }}
            >
              Use Droplet&apos;s colors
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function ColorField({
  name,
  label,
  hint,
  value,
  fallback,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const invalid = value !== "" && !HEX.test(value);
  return (
    <div>
      <label className="dr-field-label" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-field border-2 border-line bg-surface p-1 disabled:cursor-not-allowed"
        />
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder={`Default (${fallback})`}
          maxLength={7}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={`${name}-hint`}
          className={`dr-input font-mono uppercase placeholder:normal-case disabled:bg-canvas ${invalid ? "border-coral" : ""}`}
        />
      </div>
      <p id={`${name}-hint`} className="mt-1.5 text-xs text-subtle">
        {invalid ? "Use a six-digit hex color, like #0ea5e9." : hint}
      </p>
    </div>
  );
}

// A small mock of the splash page header in the chosen colors.
function Preview({ colors }: { colors: { primaryColor: string | null; secondaryColor: string | null } }) {
  return (
    <div className="dr-splash overflow-hidden rounded-card border-2 border-line-soft" style={splashThemeStyle(colors)} aria-hidden>
      <div className="relative overflow-hidden bg-sky px-5 py-5">
        <div className="absolute -top-6 right-6 size-24 rounded-full bg-coral opacity-15" />
        <div className="absolute top-3 left-1/3 size-2.5 rounded-full bg-spark opacity-80" />
        <p className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">Preview</p>
        <span className="dr-badge mt-2 bg-surface text-(--splash-link)">Esports club</span>
        <p className="mt-1 font-display text-xl font-bold text-ink">Your organization</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="dr-btn-primary px-4 py-2 text-sm">Button</span>
          <span className="text-sm font-semibold text-(--splash-link) underline">A link</span>
          <span className="flex w-10 flex-col items-center rounded-field bg-droplet-tint py-1 text-droplet">
            <span className="text-[9px] font-bold">OCT</span>
            <span className="font-display text-base leading-none font-bold">3</span>
          </span>
        </div>
      </div>
    </div>
  );
}
