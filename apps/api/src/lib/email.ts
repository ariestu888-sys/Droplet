import { env } from "../env";

// Sends email through Resend when RESEND_API_KEY is set. Returns whether the
// email was accepted for delivery; never throws, so callers can fall back
// (e.g. show the invite link to share by hand).

export const emailConfigured = () => Boolean(env.RESEND_API_KEY);

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, ...message }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Email not sent:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("Email not sent:", err);
    return false;
  }
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function invitationEmail({
  organizationName,
  roleLabel,
  inviteUrl,
}: {
  organizationName: string;
  roleLabel: string;
  inviteUrl: string;
}) {
  const org = escape(organizationName);
  const role = escape(roleLabel.toLowerCase());
  return {
    subject: `You're invited to join ${organizationName} on Droplet`,
    text: `You've been invited to join ${organizationName} on Droplet as a ${roleLabel.toLowerCase()}.\n\nAccept the invitation: ${inviteUrl}\n\nThis link expires in 14 days. If you weren't expecting it, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c2430">
  <h2 style="margin:0 0 12px">You're invited to join ${org}</h2>
  <p style="margin:0 0 20px;line-height:1.5">You've been invited to join <strong>${org}</strong> on Droplet as a ${role}.</p>
  <p style="margin:0 0 24px"><a href="${escape(inviteUrl)}" style="background:#0ea5e9;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Accept invitation</a></p>
  <p style="margin:0;color:#6b7080;font-size:13px;line-height:1.5">This link expires in 14 days. If you weren't expecting it, you can ignore this email.</p>
</div>`,
  };
}
