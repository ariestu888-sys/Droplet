import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// Supabase client that acts as the signed-in user: every database query it
// makes carries their access token, so Postgres row-level security applies.
export function createUserClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type UserClient = ReturnType<typeof createUserClient>;

// Supabase client for requests with no signed-in user (public pages). It can
// only reach what the database grants to anonymous visitors.
export const publicClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
