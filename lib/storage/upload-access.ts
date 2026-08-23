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

export function canReadUploadedObject(
  relative: string,
  access: { isStaff: boolean; personId?: string | null },
): boolean {
  if (!isSafeUploadKey(relative)) return false;
  if (isPublicUploadKey(relative)) return true;
  if (access.isStaff) return true;
  return Boolean(
    access.personId && relative.startsWith(`${DESIGN_PREFIX}${access.personId}/`),
  );
}
