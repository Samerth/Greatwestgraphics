import { describe, expect, it } from "vitest";
import {
  buildStoreApprovedEmail,
  storeFrontPath,
  storeFrontUrl,
} from "./store-approved-email";

describe("store front address", () => {
  it("uses the /s/{slug} path the site actually serves", () => {
    expect(storeFrontPath("acme")).toBe("/s/acme");
    expect(storeFrontUrl("https://shop.example.test/", "acme")).toBe(
      "https://shop.example.test/s/acme",
    );
  });
});

describe("buildStoreApprovedEmail", () => {
  it("tells the owner the store is live and includes the working link", () => {
    const mail = buildStoreApprovedEmail({
      storeName: "Acme Apparel",
      slug: "acme",
      origin: "https://shop.example.test",
      ownerName: "Sam",
    });
    expect(mail.subject).toMatch(/Acme Apparel is live/i);
    expect(mail.text).toContain("Hi Sam,");
    expect(mail.text).toContain("https://shop.example.test/s/acme");
    expect(mail.text).not.toContain("acme.greatwestgraphics.com");
  });
});
