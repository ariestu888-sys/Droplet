# Droplet

Droplet website, built with [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS) and [Supabase](https://supabase.com).

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key (Supabase dashboard → Project Settings → API).

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Supabase

- `src/lib/supabase/client.ts` — client for Client Components
- `src/lib/supabase/server.ts` — client for Server Components, Server Actions and Route Handlers
- `src/proxy.ts` — refreshes the auth session cookie on each request

Cache Components is enabled, so anything that reads the session (the server client uses `cookies()`) must render inside a `<Suspense>` boundary. See `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.
