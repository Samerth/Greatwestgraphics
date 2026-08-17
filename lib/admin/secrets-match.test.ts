import { describe, expect, it } from "vitest";
import { secretsMatch } from "./secrets-match";

describe("secretsMatch", () => {
  it("accepts an exact match", () => {
    expect(secretsMatch("correct horse battery", "correct horse battery")).toBe(
      true,
    );
  });

  it("rejects same-length values that differ", () => {
    expect(secretsMatch("correct horse batterz", "correct horse battery")).toBe(
      false,
    );
    expect(secretsMatch("Xorrect horse battery", "correct horse battery")).toBe(
      false,
    );
  });

  it("rejects a wrong length without throwing", () => {
    expect(secretsMatch("correct horse", "correct horse battery")).toBe(false);
    expect(secretsMatch("correct horse battery staple", "correct horse")).toBe(
      false,
    );
    expect(secretsMatch("", "correct horse battery")).toBe(false);
    expect(secretsMatch("anything", "")).toBe(false);
  });

  it("compares bytes, not code points", () => {
    expect(secretsMatch("café", "café")).toBe(true);
    expect(secretsMatch("café", "cafe")).toBe(false);
  });

  it("matches two empty strings, which is why an unset password must be rejected by the caller", () => {
    // `app/admin/auth/route.ts` refuses a blank STAFF_ADMIN_PASSWORD before it
    // ever gets here; this pins down why that check has to exist.
    expect(secretsMatch("", "")).toBe(true);
  });
});
