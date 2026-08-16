import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  signSessionPayload,
  timingSafeEqualHex,
  verifySessionToken,
} from "./session-crypto";

/**
 * These mint tokens the same way `createStaffSession` does rather than calling
 * it, because that function writes a cookie through `next/headers` and the
 * thing worth pinning down here is the parsing, not the cookie jar.
 */
async function mintToken(username: string, exp: number): Promise<string> {
  const payload = `${username}.${exp}`;
  return `${payload}.${await signSessionPayload(payload)}`;
}

const HOUR = 1000 * 60 * 60;

describe("verifySessionToken", () => {
  const original = process.env.STAFF_SESSION_SECRET;

  beforeEach(() => {
    process.env.STAFF_SESSION_SECRET = "test-secret-for-session-parsing";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.STAFF_SESSION_SECRET;
    else process.env.STAFF_SESSION_SECRET = original;
  });

  it("round-trips a plain username", async () => {
    const token = await mintToken("admin", Date.now() + HOUR);
    expect(await verifySessionToken(token)).toEqual({ username: "admin" });
  });

  // The regression this file exists for. The login page suggests an email
  // address, and an email contains dots.
  it("round-trips a username containing dots", async () => {
    const token = await mintToken("sam.smith@company.com", Date.now() + HOUR);
    expect(await verifySessionToken(token)).toEqual({
      username: "sam.smith@company.com",
    });
  });

  it("round-trips a username with several dots", async () => {
    const token = await mintToken("a.b.c.d", Date.now() + HOUR);
    expect(await verifySessionToken(token)).toEqual({ username: "a.b.c.d" });
  });

  it("rejects an expired token", async () => {
    const token = await mintToken("admin", Date.now() - 1000);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects an expired token for a dotted username", async () => {
    const token = await mintToken("sam.smith@company.com", Date.now() - 1000);
    expect(await verifySessionToken(token)).toBeNull();
  });

  // A non-numeric expiry used to pass, because NaN compares false against
  // everything including the current time.
  it("rejects a token whose expiry is not a number", async () => {
    const payload = "admin.not-a-number";
    const token = `${payload}.${await signSessionPayload(payload)}`;
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await mintToken("admin", Date.now() + HOUR);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await mintToken("admin", Date.now() + HOUR);
    process.env.STAFF_SESSION_SECRET = "a-different-secret";
    expect(await verifySessionToken(token)).toBeNull();
  });

  // Re-signing the payload is not enough on its own: the username has to come
  // back out unchanged, or a caller could claim a different identity.
  it("does not let the username be moved across the expiry boundary", async () => {
    const exp = Date.now() + HOUR;
    const token = await mintToken("admin.1234", exp);
    expect(await verifySessionToken(token)).toEqual({ username: "admin.1234" });
  });

  it.each([undefined, "", "no-dots", "only.two"])(
    "rejects the malformed token %j",
    async (token) => {
      expect(await verifySessionToken(token as string | undefined)).toBeNull();
    },
  );
});

describe("timingSafeEqualHex", () => {
  it("matches identical strings", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
  });

  it("rejects different strings of equal length", () => {
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqualHex("abcd", "abcde")).toBe(false);
  });
});
