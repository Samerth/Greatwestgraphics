import { describe, expect, it } from "vitest";
import { isAllowedLogoUrl, OptionalLogoUrlSchema } from "./logo-url";

const PERSON = "11111111-1111-4111-8111-111111111111";
const OBJECT = "33333333-3333-4333-8333-333333333333";

describe("isAllowedLogoUrl", () => {
  it("accepts a same-origin store-logo upload path", () => {
    expect(
      isAllowedLogoUrl(`/api/uploads/designs/${PERSON}/store-logo-${OBJECT}.png`),
    ).toBe(true);
    expect(
      isAllowedLogoUrl(`/api/uploads/store-logos/${PERSON}/${OBJECT}.png`),
    ).toBe(true);
  });

  it("accepts an https CDN URL", () => {
    expect(
      isAllowedLogoUrl(`https://cdn.example.com/store-logos/${PERSON}/${OBJECT}.png`),
    ).toBe(true);
  });

  it("rejects private artwork paths and non-http schemes", () => {
    expect(isAllowedLogoUrl(`/api/uploads/designs/${PERSON}/${OBJECT}.png`)).toBe(
      false,
    );
    expect(isAllowedLogoUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedLogoUrl("data:image/png;base64,aaaa")).toBe(false);
  });
});

describe("OptionalLogoUrlSchema", () => {
  it("allows omitting the logo", () => {
    expect(OptionalLogoUrlSchema.parse("")).toBe("");
    expect(OptionalLogoUrlSchema.parse(undefined)).toBeUndefined();
  });
});
