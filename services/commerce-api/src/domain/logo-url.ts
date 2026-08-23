/**
 * Same rule as `lib/commerce/logo-url.ts` on the web tier. Hosted uploads
 * are stored as `/api/uploads/store-logos/...` when S3 is private; those
 * fail `z.string().url()` even though the header can load them.
 */
const HOSTED_STORE_LOGO =
  /^\/api\/uploads\/(?:store-logos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|designs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/store-logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|svg)$/i;

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
