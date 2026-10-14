import { z } from "zod";

// The shapes of the Droplet API's requests and responses. The API validates
// against these and publishes them in its OpenAPI docs; clients (the website,
// the mobile app) use the inferred types. `.meta({ id })` names each one in
// the docs.

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: "unauthorized" }),
      message: z.string().meta({ example: "Missing or invalid access token." }),
    }),
  })
  .meta({ id: "ApiError" });

export const HealthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    version: z.string().meta({ example: "0.1.0" }),
    services: z.object({
      supabase: z.enum(["up", "down"]),
    }),
  })
  .meta({ id: "Health" });

export const ProfileSchema = z
  .object({
    id: z.uuid(),
    email: z.email().nullable(),
    fullName: z.string().nullable().meta({ example: "Jamie Rivera" }),
    avatarUrl: z.url().nullable(),
    provider: z.string().meta({ description: "How the user signs in.", example: "google" }),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Profile" });

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).meta({ example: "Jamie Rivera" }),
  })
  .meta({ id: "UpdateProfile" });

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Health = z.infer<typeof HealthSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
