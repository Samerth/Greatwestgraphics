import { describe, expect, it } from "vitest";
import { isAllowedLogoUrl } from "../src/domain/logo-url.js";

const PERSON = "11111111-1111-4111-8111-111111111111";
const OBJECT = "33333333-3333-4333-8333-333333333333";

describe("isAllowedLogoUrl", () => {
  it("accepts hosted store-logo paths and http(s) URLs", () => {
    expect(
      isAllowedLogoUrl(`/api/uploads/designs/${PERSON}/store-logo-${OBJECT}.jpg`),
    ).toBe(true);
    expect(
      isAllowedLogoUrl(`/api/uploads/store-logos/${PERSON}/${OBJECT}.jpg`),
    ).toBe(true);
    expect(isAllowedLogoUrl("https://assets.example.com/acme.png")).toBe(true);
  });

  it("rejects private artwork paths", () => {
    expect(
      isAllowedLogoUrl(`/api/uploads/designs/${PERSON}/${OBJECT}.jpg`),
    ).toBe(false);
  });
});
