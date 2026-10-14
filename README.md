# Droplet

Droplet is built as three tiers, so the website and a future mobile app share one backend:

```
 Presentation             Application                 Data
┌──────────────────┐     ┌────────────────────┐     ┌─────────────────────┐
│ apps/web         │     │ apps/api           │     │ Supabase            │
│ Next.js website  ├────►│ Droplet REST API   ├────►│ Postgres + Auth     │
│ (later: mobile)  │HTTPS│ /v1, OpenAPI docs  │     │                     │
└────────┬─────────┘     └────────────────────┘     └──────────▲──────────┘
         └────────────── sign-in only (Supabase Auth) ─────────┘
```

- **Presentation, `apps/web`:** the [Next.js](https://nextjs.org) website (App Router, TypeScript, Tailwind CSS). It signs people in with Supabase Auth, then gets and changes all app data through the API, sending the user's access token.
- **Application, `apps/api`:** a [Hono](https://hono.dev) REST API. It checks each request's access token, holds the business rules, and is the only tier that touches the data. It's designed as a public API: versioned under `/v1`, consistent JSON errors, and OpenAPI docs.
- **Data, Supabase:** Postgres and Auth. The API talks to it as the signed-in user, so database row-level security still applies.
- **`packages/shared`:** request and response schemas (zod) and a typed API client, used by the website and ready for the mobile app.

## Getting started

1. Install dependencies (from the repo root):

   ```bash
   npm install
   ```

2. Fill in environment files from the examples (Supabase dashboard → Project Settings → API):
   - `apps/web/.env.example` → `apps/web/.env.local`
   - `apps/api/.env.example` → `apps/api/.env`

3. Start the API and the website together:

   ```bash
   npm run dev
   ```

   - Website: [http://localhost:3001](http://localhost:3001)
   - API docs: [http://localhost:4000/docs](http://localhost:4000/docs)

   Or run one at a time with `npm run dev:web` / `npm run dev:api`.

Other scripts from the root: `npm run build`, `npm run lint`, `npm run typecheck`.

## Database

Schema changes live in `supabase/migrations/` as SQL files, applied in filename order. To apply one, paste it into the Supabase dashboard's **SQL Editor** and run it (or use the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link`, then `supabase db push`).

- `20261014000000_organizations.sql`: `organizations` and `organization_members` tables, row-level security (people only see organizations they belong to), and the `create_organization` function the API calls.
- `20261014010000_organization_details.sql`: organization type (a starter list plus custom types people add), ZIP code, address, Discord and website links, and logos (stored in the public `organization-logos` Storage bucket; only an organization's owners and admins can upload).
- `20261014020000_update_organization.sql`: the `update_organization` function, so owners and admins can edit their organization's details.

## The API

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/v1/health` | — | API and Supabase status |
| GET | `/v1/me` | Bearer | The signed-in user's profile |
| PATCH | `/v1/me` | Bearer | Update the signed-in user's name |
| GET | `/v1/organizations` | Bearer | Organizations the user belongs to, with their role |
| POST | `/v1/organizations` | Bearer | Create an organization (the user becomes its owner) |
| PUT | `/v1/organizations/{id}/logo` | Bearer | Upload or replace its logo (multipart, field `file`; PNG, JPEG or WebP up to 2 MB) |
| GET | `/v1/organizations/{id}` | Bearer | One organization the user belongs to |
| PATCH | `/v1/organizations/{id}` | Bearer | Edit its details (owners and admins; send `null` to clear a field) |
| DELETE | `/v1/organizations/{id}/logo` | Bearer | Remove its logo (owners and admins) |
| GET | `/v1/organization-types` | Bearer | Organization types: the starter list plus custom ones |

The full, live specification is at `/v1/openapi.json`, with interactive docs at `/docs`.

**Calling it:** sign in with Supabase Auth (any client: supabase-js on the web, or the Supabase SDK for React Native, Flutter, Swift or Kotlin), then send the session's access token:

```
Authorization: Bearer <access token>
```

Errors always look like `{ "error": { "code": "unauthorized", "message": "…" } }`.

**Adding an endpoint:**
1. Add its schemas to `packages/shared/src/schemas.ts`.
2. Add a route file in `apps/api/src/routes/` and mount it in `apps/api/src/app.ts`.
3. Add a method to the client in `packages/shared/src/client.ts`.

`CORS_ORIGINS` in `apps/api/.env` lists the browser origins allowed to call the API. Native mobile apps don't need to be listed.

## Website

- `src/lib/api/server.ts`: Droplet API client for Server Components and Server Actions
- `src/lib/supabase/`: Supabase clients, used for signing in and out only
- `src/proxy.ts`: refreshes the sign-in cookie on each request, and redirects signed-out visitors away from `/account`

Cache Components is enabled, so anything that reads the session (via `cookies()`) must render inside a `<Suspense>` boundary. See `apps/web/node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` (or the root `node_modules`).

### Accounts

People can create an account with email and password (`/signup`) or with Google, and log in at `/login`. After signing in they land on `/home`.

Signed-in pages live in `src/app/(app)/` and share a menu (a navy sidebar on wide screens, a top bar on phones), defined in `src/components/app-shell/nav-items.ts`:

- **Create Organization** (`/organizations/new`)
- **Home** (`/home`): greeting and the user's organizations; each opens its page at `/organizations/<id>`, which owners and admins can edit at `/organizations/<id>/edit`
- **Account** (`/account`): profile, and changing their name
- **Log out**

- `src/app/auth/actions.ts`: sign up, log in, Google sign-in and log out
- `src/app/auth/callback/route.ts`: where Supabase returns people after Google sign-in or the email confirmation link
- `src/app/auth/confirm/route.ts`: optional, for email templates that use `{{ .TokenHash }}`

Supabase setup (dashboard):

1. **Authentication → URL Configuration:** set Site URL to your site's address, and add `http://localhost:3001/**` (plus your production URL followed by `/**`) under Redirect URLs.
2. **Authentication → Sign In / Providers → Google:** turn it on and paste a Client ID and Client Secret from a Google Cloud OAuth client (type "Web application"). In Google Cloud, add Supabase's callback URL, `https://<project-ref>.supabase.co/auth/v1/callback`, as an authorized redirect URI.
