import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Comma-separated browser origins allowed to call the API (the website).
  // Native mobile apps don't need to be listed: CORS only applies to browsers.
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3001")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  // The website's address, for links in emails (e.g. invitations).
  PUBLIC_SITE_URL: z.url().default("http://localhost:3001"),
  // Optional: send emails through Resend (https://resend.com). Without a key,
  // invitations are still created and organizers share the link themselves.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Droplet <onboarding@resend.dev>"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid API environment variables:", z.flattenError(parsed.error).fieldErrors);
  console.error("Copy apps/api/.env.example to apps/api/.env and fill it in.");
  process.exit(1);
}

export const env = parsed.data;
