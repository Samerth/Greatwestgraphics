import { timingSafeEqual } from "node:crypto";

/**
 * Compares without leaking how many characters matched.
 *
 * This is a deliberate copy of `secretsMatch` in
 * `services/commerce-api/src/auth.ts` rather than an import: that file lives in
 * a separate npm workspace which the web `tsconfig.json` excludes, and it pulls
 * Fastify and `@gwg/contracts` in with it. Two lines of duplication beat
 * dragging the API server's dependency graph into the Next bundle — but the two
 * must not drift, so change them together.
 */
export function secretsMatch(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // disclosure, so compare a fixed-width digest of equal length instead.
  if (suppliedBytes.length !== expectedBytes.length) {
    const padded = Buffer.alloc(expectedBytes.length);
    suppliedBytes.copy(padded);
    timingSafeEqual(padded, expectedBytes);
    return false;
  }
  return timingSafeEqual(suppliedBytes, expectedBytes);
}
