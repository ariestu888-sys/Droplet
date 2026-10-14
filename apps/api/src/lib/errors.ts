import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

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
