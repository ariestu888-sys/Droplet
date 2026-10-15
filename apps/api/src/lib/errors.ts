import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PostgrestError } from "@supabase/supabase-js";

// Throw from any handler; the app's error handler turns it into
// { "error": { "code", "message" } } with the given status.
export class ApiException extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(status, { message });
  }
}

export const unauthorized = (message = "Missing or invalid access token.") =>
  new ApiException(401, "unauthorized", message);

// Turns a Supabase/Postgres error into an API error.
export function databaseError(error: PostgrestError): ApiException {
  // Missing table or function: a database migration hasn't been applied.
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code)) {
    return new ApiException(503, "not_set_up", "This feature isn't set up in the database yet.");
  }
  if (error.code === "42501") return new ApiException(403, "forbidden", error.message || "You don't have permission to do that.");
  if (error.code === "P0002") return new ApiException(404, "not_found", error.message || "Not found.");
  if (error.code === "22023" || error.code === "23514") {
    return new ApiException(400, "invalid_request", error.message);
  }
  console.error(error);
  return new ApiException(502, "database_error", "The database couldn't complete the request.");
}
