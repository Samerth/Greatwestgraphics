import { describe, expect, it } from "vitest";
import { shippingSchema } from "./checkout";

/**
 * 21 Sep, client-meeting note: the assistant tells customers "anywhere in
 * Canada and the United States" (docs/CODCHAT_KNOWLEDGE_BASE.md), but
 * `shippingSchema` enforced the Canadian postal format unconditionally while
 * `country` was free text — a real Seattle address (98101) could never pass
 * checkout. These pin the country-aware check: Canadian format for Canada,
 * ZIP for the US, and a loose non-empty check for anywhere else, so a country
 * we don't specifically recognise is never silently rejected.
 */
const base = {
  address1: "1234 Industrial Ave",
  city: "Vancouver",
  region: "BC",
  country: "Canada",
  postalCode: "V6A 1A1",
};

describe("shippingSchema: postal code depends on the country typed", () => {
  it("accepts a Canadian postal code for Canada, with or without the space", () => {
    expect(shippingSchema.safeParse({ ...base, postalCode: "V6A 1A1" }).success).toBe(true);
    expect(shippingSchema.safeParse({ ...base, postalCode: "V6A1A1" }).success).toBe(true);
  });

  it("rejects a US zip code for Canada", () => {
    const result = shippingSchema.safeParse({ ...base, postalCode: "98101" });
    expect(result.success).toBe(false);
  });

  it("accepts a 5-digit and a ZIP+4 US zip code for the United States", () => {
    const address = { ...base, region: "WA", city: "Seattle" };
    expect(
      shippingSchema.safeParse({ ...address, country: "United States", postalCode: "98101" })
        .success,
    ).toBe(true);
    expect(
      shippingSchema.safeParse({ ...address, country: "USA", postalCode: "98101-1234" }).success,
    ).toBe(true);
    expect(
      shippingSchema.safeParse({ ...address, country: "US", postalCode: "98101" }).success,
    ).toBe(true);
  });

  it("rejects a Canadian postal code for the United States", () => {
    const result = shippingSchema.safeParse({
      ...base,
      country: "United States",
      postalCode: "V6A 1A1",
    });
    expect(result.success).toBe(false);
  });

  it("recognises common spellings and casing of both countries", () => {
    for (const spelling of ["canada", "CANADA", "Can.", " Canada "]) {
      expect(
        shippingSchema.safeParse({ ...base, country: spelling, postalCode: "V6A 1A1" }).success,
        spelling,
      ).toBe(true);
    }
    for (const spelling of ["united states of america", "u.s.a.", "U.S."]) {
      expect(
        shippingSchema.safeParse({ ...base, country: spelling, postalCode: "98101" }).success,
        spelling,
      ).toBe(true);
    }
  });

  it("accepts a reasonable-looking code for a country it does not specifically recognise", () => {
    const result = shippingSchema.safeParse({
      ...base,
      country: "United Kingdom",
      postalCode: "SW1A 1AA",
    });
    expect(result.success).toBe(true);
  });

  it("still rejects an empty or near-empty postal code for an unrecognised country", () => {
    const result = shippingSchema.safeParse({ ...base, country: "United Kingdom", postalCode: "1" });
    expect(result.success).toBe(false);
  });

  it("still requires the other address fields", () => {
    const result = shippingSchema.safeParse({ ...base, address1: "" });
    expect(result.success).toBe(false);
  });
});
