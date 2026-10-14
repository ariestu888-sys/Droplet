import { createMiddleware } from "hono/factory";
import { createUserClient, type UserClient } from "../lib/supabase";
import { unauthorized } from "../lib/errors";

export type AuthVariables = {
  userId: string;
  accessToken: string;
  supabase: UserClient;
};

// Requires `Authorization: Bearer <Supabase access token>`. The website and
// the mobile app get this token from Supabase Auth when the user signs in.
export const requireUser = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw unauthorized();

  const supabase = createUserClient(token);
  // Verifies the token's signature and expiry (locally when the project uses
  // asymmetric signing keys, otherwise via Supabase Auth).
  // Malformed tokens make it throw rather than return an error.
  const result = await supabase.auth.getClaims(token).catch(() => null);
  const sub = result?.data?.claims.sub;
  if (result?.error || !sub) throw unauthorized();

  c.set("userId", sub);
  c.set("accessToken", token);
  c.set("supabase", supabase);
  await next();
});
