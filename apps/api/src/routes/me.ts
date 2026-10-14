import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { User } from "@supabase/supabase-js";
import { ApiErrorSchema, ProfileSchema, UpdateProfileSchema, type Profile } from "@droplet/shared";
import { requireUser, type AuthVariables } from "../middleware/auth";
import { ApiException, unauthorized } from "../lib/errors";
import { env } from "../env";

function toProfile(user: User): Profile {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: meta.full_name ?? meta.name ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    provider: user.app_metadata.provider ?? "email",
    createdAt: user.created_at,
  };
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

const getMe = createRoute({
  method: "get",
  path: "/me",
  tags: ["Account"],
  summary: "Get the signed-in user's profile",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  responses: {
    200: { description: "The user's profile", content: { "application/json": { schema: ProfileSchema } } },
    401: errorResponse("Not signed in"),
  },
});

const updateMe = createRoute({
  method: "patch",
  path: "/me",
  tags: ["Account"],
  summary: "Update the signed-in user's profile",
  security: [{ Bearer: [] }],
  middleware: [requireUser] as const,
  request: {
    body: { required: true, content: { "application/json": { schema: UpdateProfileSchema } } },
  },
  responses: {
    200: { description: "The updated profile", content: { "application/json": { schema: ProfileSchema } } },
    400: errorResponse("Invalid input"),
    401: errorResponse("Not signed in"),
  },
});

export const me = new OpenAPIHono<{ Variables: AuthVariables }>()
  .openapi(getMe, async (c) => {
    const { data, error } = await c.var.supabase.auth.getUser(c.var.accessToken);
    if (error || !data.user) throw unauthorized();
    return c.json(toProfile(data.user), 200);
  })
  .openapi(updateMe, async (c) => {
    const { fullName } = c.req.valid("json");

    // Supabase Auth's REST endpoint, called as the user.
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${c.var.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { full_name: fullName } }),
    });
    if (res.status === 401 || res.status === 403) throw unauthorized();
    if (!res.ok) throw new ApiException(502, "upstream_error", "Couldn't update the profile.");

    return c.json(toProfile((await res.json()) as User), 200);
  });
