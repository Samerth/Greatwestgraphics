export const STORE_LOGO_PREFIX = "store-logos/";
export const DESIGN_PREFIX = "designs/";

export type UploadPurpose = "design" | "store-logo";

/**
 * Customer artwork stays private. Store logos are shown on the public
 * branded header and the staff pending list, so they have to be readable
 * without a session.
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
  const prefix = purpose === "store-logo" ? STORE_LOGO_PREFIX : DESIGN_PREFIX;
  return `${prefix}${personId}/${objectId}.${extension}`;
}

export function isSafeUploadKey(relative: string): boolean {
  if (!relative || relative.includes("\\") || relative.startsWith("/")) {
    return false;
  }
  const parts = relative.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function isPublicUploadKey(relative: string): boolean {
  return isSafeUploadKey(relative) && relative.startsWith(STORE_LOGO_PREFIX);
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
