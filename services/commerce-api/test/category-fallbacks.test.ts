import { describe, expect, it } from "vitest";
import {
  KEYWORD_FALLBACKS,
  fallbackCategorySlugs,
} from "../src/adapters/catalog/writer.js";

/** Preferred slug (first match). Callers then walk the list until a tenant category exists. */
const best = (text: string): string | undefined => fallbackCategorySlugs(text)[0];

describe("fallbackCategorySlugs", () => {
  it("files the garments that previously fell through uncategorised", () => {
    expect(best("Port Authority Quarter-Zip Pullover")).toBe("quarter-zips");
    expect(fallbackCategorySlugs("Port Authority Quarter-Zip Pullover")).toContain(
      "hoodies-and-crewnecks",
    );
    expect(best("Sport-Tek 1/4 Zip Sweatshirt")).toBe("quarter-zips");
    expect(best("Micro Fleece Half-Zip")).toBe("hoodies-and-crewnecks");
    expect(best("Structured Twill Cap")).toBe("hats");
    expect(best("Merino Wool Crew Socks")).toBe("socks");
  });

  it("prefers the specific hi-vis type, then safety, over the garment it imitates", () => {
    expect(best("ANSI Class 2 Safety Vest")).toBe("safety");
    expect(best("Hi-Vis Reflective Jacket")).toBe("hi-vis-jackets");
    expect(fallbackCategorySlugs("Hi-Vis Reflective Jacket")).toContain("safety");
    // Without the hi-vis signal a puffer vest is the vest subtype, then vests.
    expect(best("Puffer Vest")).toBe("puffy");
    expect(fallbackCategorySlugs("Puffer Vest")).toContain("vests");
  });

  it("no longer matches on letters buried inside an unrelated word", () => {
    // `hat` and `bag` used to match without word boundaries, so these landed
    // in Hats and Tote Bags respectively.
    expect(best("Chatham Oxford Shirt")).not.toBe("hats");
    expect(best("Baggy Carpenter Pant")).not.toBe("tote-bags");
    expect(best("Escape Windbreaker")).toBe("windbreakers");
    expect(fallbackCategorySlugs("Escape Windbreaker")).toContain("jackets");
  });

  it("still matches the categories it always did", () => {
    expect(best("Gildan Heavy Cotton Tee")).toBe("t-shirts");
    expect(best("Classic Pique Polo")).toBe("polos");
    expect(best("Canvas Tote Bag")).toBe("tote-bags");
    expect(best("Hockey Jersey")).toBe("jerseys");
    expect(best("Softshell Jacket")).toBe("softshell");
    expect(fallbackCategorySlugs("Softshell Jacket")).toContain("jackets");
  });

  it("returns nothing when the text suggests no category", () => {
    expect(fallbackCategorySlugs("Assorted Item 12345")).toEqual([]);
  });

  it("returns candidates in rule order without duplicates", () => {
    const slugs = fallbackCategorySlugs("Safety Hi-Vis Fleece Vest");
    expect(slugs[0]).toBe("safety");
    expect(slugs).toContain("vests");
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers the names S&S's own copy of these rules used to miss", () => {
    // The S&S sync carried a private, older copy of this list until it was
    // pointed at the shared one. These are the cases that differed.
    expect(best("Independent Trading Quarter Zip Pullover")).toBe("quarter-zips");
    expect(fallbackCategorySlugs("Independent Trading Quarter Zip Pullover")).toContain(
      "hoodies-and-crewnecks",
    );
    expect(best("ANSI Class 3 Hi-Vis Vest")).toBe("safety");
    expect(best("Ribbed Crew Socks")).toBe("socks");
    expect(best("Stainless Steel Tumbler")).toBe("tumblers");
    expect(fallbackCategorySlugs("Stainless Steel Tumbler")).toContain("drinkware");
    expect(best("Hardcover Journal")).toBe("journals");
    expect(fallbackCategorySlugs("Hardcover Journal")).toContain("notebooks");
    expect(best("Embroidered Patch")).toBe("patches");
  });

  it("uses stateless patterns, so repeated calls agree", () => {
    // A stray /g flag would make .test() advance lastIndex and alternate.
    for (const rule of KEYWORD_FALLBACKS) {
      expect(rule.pattern.global).toBe(false);
    }
    expect(best("Structured Twill Cap")).toBe(best("Structured Twill Cap"));
  });
});
