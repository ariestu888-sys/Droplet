import { z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@droplet/shared";
import { env } from "../env";
import { ApiException } from "./errors";

// Organization and sponsor logos, stored in a public Storage bucket under
// "<organization id>/" (only that organization's owners and admins can write).

export const LOGO_BUCKET = "organization-logos";

export const publicLogoUrl = (path: string | null) =>
  path ? `${env.SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${path}` : null;

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

// Checks the file's first bytes really are a PNG, JPEG or WebP image.
function sniffImageType(bytes: Uint8Array): (typeof LOGO_TYPES)[number] | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

// Rejects uploads over the size limit before reading them.
export const logoBodyLimit = bodyLimit({
  maxSize: LOGO_MAX_BYTES + 64 * 1024,
  onError: () => {
    throw new ApiException(413, "file_too_large", "Logos can be up to 2 MB.");
  },
});

// The multipart body of a logo upload, for OpenAPI docs and validation.
export const logoUploadBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: z.object({ file: z.any().openapi({ type: "string", format: "binary" }) }),
    },
  },
} as const;

// Validates an uploaded logo and returns its bytes, type and file extension.
export async function readLogoUpload(file: unknown) {
  if (!(file instanceof File)) {
    throw new ApiException(400, "invalid_request", 'Send the image in a form field named "file".');
  }
  if (file.size > LOGO_MAX_BYTES) throw new ApiException(413, "file_too_large", "Logos can be up to 2 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new ApiException(400, "invalid_image", "Logos must be PNG, JPEG or WebP images.");
  return { bytes, contentType, extension: EXTENSIONS[contentType] };
}

export const LOGO_UPLOAD_DESCRIPTION = `A PNG, JPEG or WebP image of up to ${LOGO_MAX_BYTES / 1024 / 1024} MB, sent as multipart/form-data in a field named \`file\`.`;
