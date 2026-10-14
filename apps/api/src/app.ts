import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env";
import { ApiException } from "./lib/errors";
import { health } from "./routes/health";
import { me } from "./routes/me";
import { organizations } from "./routes/organizations";

export const app = new OpenAPIHono({
  // Request validation failures use the same error shape as everything else.
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
      return c.json({ error: { code: "invalid_request", message } }, 400);
    }
  },
});

app.use(logger());
app.use(secureHeaders());
app.use(
  "/v1/*",
  cors({
    origin: env.CORS_ORIGINS,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

// Version 1 of the public API. Breaking changes go in a new /v2.
const v1 = new OpenAPIHono();
v1.route("/", health);
v1.route("/", me);
v1.route("/", organizations);
app.route("/v1", v1);

app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "A Supabase access token for the signed-in user.",
});

app.doc31("/v1/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Droplet API",
    version: "1.0.0",
    description: "Public REST API behind the Droplet website and apps.",
  },
});
app.get("/docs", swaggerUI({ url: "/v1/openapi.json" }));
app.get("/", (c) => c.redirect("/docs"));

app.notFound((c) => c.json({ error: { code: "not_found", message: "No such endpoint." } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: "http_error", message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: "internal_error", message: "Something went wrong." } }, 500);
});
