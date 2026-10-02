import { describe, expect, it } from "vitest";
import { loadEnvironment } from "./config.js";

const base = { DATABASE_URL: "postgres://user:pass@localhost:5432/gwg" };

describe("SANMAR_BULK_LOGIN_EMAIL", () => {
  it("is optional", () => {
    expect(loadEnvironment(base).SANMAR_BULK_LOGIN_EMAIL).toBeUndefined();
  });

  it("reads a valid e-mail", () => {
    expect(
      loadEnvironment({ ...base, SANMAR_BULK_LOGIN_EMAIL: "buyer@example.com" })
        .SANMAR_BULK_LOGIN_EMAIL,
    ).toBe("buyer@example.com");
  });

  it("treats a blank value as unset instead of refusing to start", () => {
    expect(
      loadEnvironment({ ...base, SANMAR_BULK_LOGIN_EMAIL: "" })
        .SANMAR_BULK_LOGIN_EMAIL,
    ).toBeUndefined();
    expect(
      loadEnvironment({ ...base, SANMAR_BULK_LOGIN_EMAIL: "   " })
        .SANMAR_BULK_LOGIN_EMAIL,
    ).toBeUndefined();
  });

  it("still rejects a value that is not an e-mail", () => {
    expect(() =>
      loadEnvironment({ ...base, SANMAR_BULK_LOGIN_EMAIL: "not-an-email" }),
    ).toThrow();
  });
});
