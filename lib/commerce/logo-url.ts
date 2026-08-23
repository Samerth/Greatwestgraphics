import { z } from "zod";

/**
 * Hosted logos come back from `/api/uploads` as a same-origin path when the
 * bucket is private. `z.string().url()` rejects those, so store create has to
 * accept that prefix as well as a normal http(s) URL (S3 public CDN, etc).
 */
const HOSTED_STORE_LOGO =
  /^\/api\/uploads\/store-logos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|svg)$/i;

export function isAllowedLogoUrl(value: string): boolean {
  if (!value || value.length > 2000) return false;
  if (HOSTED_STORE_LOGO.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const LogoUrlSchema = z
  .string()
  .max(2000)
  .refine(isAllowedLogoUrl, "Upload a logo file or provide a valid image URL.");

export const OptionalLogoUrlSchema = LogoUrlSchema.optional().or(z.literal(""));
