import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HealthSchema } from "@droplet/shared";
import { env } from "../env";

const VERSION = "0.1.0";

const route = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Check that the API and Supabase are reachable",
  responses: {
    200: { description: "Service status", content: { "application/json": { schema: HealthSchema } } },
  },
});

export const health = new OpenAPIHono().openapi(route, async (c) => {
  let supabase: "up" | "down" = "down";
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) supabase = "up";
  } catch {
    // Reported as "down" below.
  }

  return c.json(
    { status: supabase === "up" ? "ok" : "degraded", version: VERSION, services: { supabase } } as const,
    200,
  );
});
