export const STORE_LOGO_PREFIX = "store-logos/";
export const DESIGN_PREFIX = "designs/";
export const STORE_LOGO_FILENAME_PREFIX = "store-logo-";

export type UploadPurpose = "design" | "store-logo";

/**
 * The ECS task role is scoped to `designs/*` (see 09-create-ecs.sh). Store
 * logos therefore live under that prefix with a `store-logo-` filename so
 * PutObject succeeds on staging without a separate IAM change. The filename
 * is what makes them publicly readable; ordinary artwork stays private.
 */
export function parseUploadPurpose(value: FormDataEntryValue | null): UploadPurpose | null {
  if (value == null || value === "" || value === "design") return "design";
  if (value === "store-logo") return "store-logo";
  return null;
}

export function uploadObjectKey(
  purpose: UploadPurpose,
  personId: string,
  objectId: string,
  extension: string,
): string {
  if (purpose === "store-logo") {
    return `${DESIGN_PREFIX}${personId}/${STORE_LOGO_FILENAME_PREFIX}${objectId}.${extension}`;
  }
  return `${DESIGN_PREFIX}${personId}/${objectId}.${extension}`;
}

export function isSafeUploadKey(relative: string): boolean {
  if (!relative || relative.includes("\\") || relative.startsWith("/")) {
    return false;
  }
  const parts = relative.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

const HOSTED_STORE_LOGO_KEY =
  /^designs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/store-logo-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|svg)$/i;

export function isPublicUploadKey(relative: string): boolean {
  if (!isSafeUploadKey(relative)) return false;
  // Current uploads, plus the store-logos/ prefix from the first revision.
  return (
    HOSTED_STORE_LOGO_KEY.test(relative) || relative.startsWith(STORE_LOGO_PREFIX)
  );
}

/**
 * Recovers the storage key from a stored artwork URL, regardless of which
 * shape `S3ImageStore.put` handed back: `/api/uploads/<key>` (no public CDN
 * configured) or `<AWS_S3_PUBLIC_BASE_URL>/<key>` (one configured). Every key
 * starts with `designs/` (`uploadObjectKey`), so that's the anchor — reading
 * the env var back here would need one path when it's set and a different
 * one when it isn't, and would still need this same fallback for artwork
 * saved before a base URL existed.
 */
export function uploadKeyFromUrl(url: string): string | null {
  const withoutQuery = url.split(/[?#]/)[0] ?? "";
  const marker = `${DESIGN_PREFIX}`;
  const index = withoutQuery.indexOf(marker);
  if (index === -1) return null;
  const key = withoutQuery.slice(index);
  return isSafeUploadKey(key) ? key : null;
}

export function canReadUploadedObject(
  relative: string,
  access: { isStaff: boolean; personId?: string | null; guestId?: string | null },
): boolean {
  if (!isSafeUploadKey(relative)) return false;
  if (isPublicUploadKey(relative)) return true;
  if (access.isStaff) return true;
  // Checked as an OR, not swapped on sign-in: someone who uploaded artwork
  // as a guest and then signed in mid-session still owns that file under
  // its original guest-tagged folder. Dropping the guest check the moment
  // a session exists would make their own just-uploaded artwork 404.
  const owners = [access.personId, access.guestId].filter(
    (id): id is string => Boolean(id),
  );
  return owners.some((id) => relative.startsWith(`${DESIGN_PREFIX}${id}/`));
}
