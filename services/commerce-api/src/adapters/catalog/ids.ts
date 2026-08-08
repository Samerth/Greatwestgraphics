import { createHash } from "node:crypto";

/**
 * Stable positive 31-bit integer from an opaque vendor key.
 * Used when the vendor does not supply numeric style/SKU ids (Sanmar, CSV).
 * Uniqueness is still scoped by (tenant, vendor, …) so collisions across
 * vendors are irrelevant; within a vendor the hash space is large enough
 * for catalog sizes we expect.
 */
export function externalKeyToNumericId(externalKey: string): number {
  const digest = createHash("sha1").update(externalKey).digest();
  const n = digest.readUInt32BE(0) & 0x7fffffff;
  return n === 0 ? 1 : n;
}

export function parseOptionalInt(value: string | undefined | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
