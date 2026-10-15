"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { JOIN_LINK_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type JoinLink, type JoinLinkRole } from "@droplet/shared";
import { createJoinLink, turnOffJoinLink } from "./actions";
import { RoleBadge } from "./members-manager";

// One card per joinable role: create a shareable link, copy it, show or
// download its QR code, reset it or turn it off.
export function JoinLinks({
  organizationId,
  organizationSlug,
  links,
}: {
  organizationId: string;
  organizationSlug: string;
  links: JoinLink[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {JOIN_LINK_ROLES.map((role) => (
        <JoinLinkCard
          key={role}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          role={role}
          link={links.find((l) => l.role === role) ?? null}
        />
      ))}
    </div>
  );
}

function JoinLinkCard({
  organizationId,
  organizationSlug,
  role,
  link,
}: {
  organizationId: string;
  organizationSlug: string;
  role: JoinLinkRole;
  link: JoinLink | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "off" | null>(null);
  const [showQr, setShowQr] = useState(false);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      setConfirm(null);
      if (result.error) setError(result.error);
    });

  return (
    <section aria-label={`${ROLE_LABELS[role]} join link`} className="flex flex-col gap-3 rounded-field border-2 border-line-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <RoleBadge role={role} />
        {link && <span className="text-xs font-semibold text-[#11743a]">On</span>}
      </div>
      <p className="text-xs leading-snug text-muted">Anyone with this link who signs in joins as a {ROLE_LABELS[role].toLowerCase()}: {ROLE_DESCRIPTIONS[role].toLowerCase()}.</p>

      {link ? (
        <>
          <CopyField url={link.url} label={`${ROLE_LABELS[role]} join link`} />
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setShowQr((s) => !s)} className="dr-btn-secondary px-3 py-1.5 text-xs">
              {showQr ? "Hide QR code" : "QR code"}
            </button>
            <button type="button" onClick={() => setConfirm("reset")} className="dr-btn-ghost px-2.5 py-1.5 text-xs">
              Reset
            </button>
            <button type="button" onClick={() => setConfirm("off")} className="dr-btn-ghost px-2.5 py-1.5 text-xs text-[#b8321f]">
              Turn off
            </button>
          </div>
          {showQr && <QrCode url={link.url} fileName={`${organizationSlug}-${role}-join-qr.png`} role={role} />}
          {confirm && (
            <div role="alertdialog" aria-label="Confirm" className="flex flex-col gap-2 rounded-field bg-coral-tint p-3 text-xs text-ink">
              <p>
                {confirm === "reset"
                  ? "Make a new link? The current link and QR code will stop working."
                  : "Turn this link off? The link and QR code will stop working."}
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  autoFocus
                  disabled={pending}
                  onClick={() => run(() => (confirm === "reset" ? createJoinLink(organizationId, role) : turnOffJoinLink(link.id)))}
                  className="dr-btn-primary bg-[#c2341f] px-3 py-1.5 text-xs shadow-none hover:shadow-none disabled:opacity-60"
                >
                  {pending ? "Working…" : confirm === "reset" ? "Yes, reset" : "Yes, turn off"}
                </button>
                <button type="button" onClick={() => setConfirm(null)} className="dr-btn-ghost px-2.5 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createJoinLink(organizationId, role))}
          className="dr-btn-secondary mt-auto px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create link"}
        </button>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-[#b8321f]">{error}</p>}
    </section>
  );
}

function CopyField({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border-2 border-line bg-surface px-2 py-1.5 font-mono text-[11px] text-ink"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="dr-btn-primary shrink-0 px-3 py-1.5 text-xs"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// The link as a QR code, generated in the browser, with a PNG download for
// printing on flyers or showing on a screen.
function QrCode({ url, fileName, role }: { url: string; fileName: string; role: JoinLinkRole }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1c2430", light: "#ffffff" } })
      .then((d) => current && setDataUrl(d))
      .catch(() => current && setDataUrl(null));
    return () => {
      current = false;
    };
  }, [url]);

  if (!dataUrl) return <div className="aspect-square w-full animate-pulse rounded-field bg-divider" aria-label="Making QR code" />;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL */}
      <img
        src={dataUrl}
        alt={`QR code to join as a ${ROLE_LABELS[role].toLowerCase()}`}
        className="aspect-square w-full max-w-60 rounded-field border-2 border-line-soft"
      />
      <a href={dataUrl} download={fileName} className="text-xs font-bold text-[#0369a1] hover:underline">
        Download QR code (PNG)
      </a>
    </div>
  );
}
