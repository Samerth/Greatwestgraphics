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
      "hoodies-sweatshirts",
    );
    expect(best("Sport-Tek 1/4 Zip Sweatshirt")).toBe("quarter-zips");
    expect(best("Micro Fleece Half-Zip")).toBe("hoodies-sweatshirts");
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

  it("does not file short/long sleeve polos under the T-shirt sleeve-length categories", () => {
    // These used to also pick up "short-sleeve" / "long-sleeve" purely from
    // the sleeve-length words, leaking collared styles into the T-Shirts
    // taxonomy. They should only land in the polo-specific slugs.
    expect(fallbackCategorySlugs("Classic Pique Short Sleeve Polo")).not.toContain("short-sleeve");
    expect(fallbackCategorySlugs("Classic Pique Short Sleeve Polo")).toContain("polos");
    expect(fallbackCategorySlugs("Performance Long Sleeve Polo")).not.toContain("long-sleeve");
    expect(fallbackCategorySlugs("Performance Long Sleeve Polo")).toContain("polos-long-sleeve");
    // A real short-sleeve tee should still match normally.
    expect(fallbackCategorySlugs("Ultra Cotton Short Sleeve Tee")).toContain("short-sleeve");
  });

  it("treats short-sleeve as the default for a plain tee, not a literal phrase match", () => {
    // Real catalog titles almost never say "short sleeve" on a plain tee --
    // only long-sleeve variants get called out explicitly. Requiring the
    // literal phrase left the Short Sleeve category empty in production.
    expect(fallbackCategorySlugs("Gildan Heavy Cotton Tee")).toContain("short-sleeve");
    expect(fallbackCategorySlugs("Gildan Heavy Cotton Tee")).toContain("t-shirts");
    // But it must still stay "t-shirts" as the *preferred* category.
    expect(best("Gildan Heavy Cotton Tee")).toBe("t-shirts");
    // An explicitly long-sleeve tee must NOT also get tagged short-sleeve,
    // regardless of which word comes first in the title.
    expect(fallbackCategorySlugs("Ultra Cotton Long Sleeve Tee")).not.toContain("short-sleeve");
    expect(fallbackCategorySlugs("Long Sleeve Ultra Cotton Tee")).not.toContain("short-sleeve");
    expect(fallbackCategorySlugs("Long Sleeve Ultra Cotton Tee")).toContain("long-sleeve");
  });

  it("recognizes the L/S vendor abbreviation as long-sleeve, not just the spelled-out phrase", () => {
    // Caught live in staging: "ATC EuroSpun Ring Spun L/S Tee" was showing up
    // under Short Sleeve because only the literal words "long sleeve" were
    // excluded, not the common vendor abbreviation.
    expect(fallbackCategorySlugs("ATC EuroSpun Ring Spun L/S Tee")).toContain("long-sleeve");
    expect(fallbackCategorySlugs("ATC EuroSpun Ring Spun L/S Tee")).not.toContain("short-sleeve");
    expect(fallbackCategorySlugs("ATC EuroSpun Ring Spun L/S Tee")).toContain("t-shirts");
    // Same abbreviation on a polo should route the same way as the
    // spelled-out version already does.
    expect(fallbackCategorySlugs("Performance L/S Polo")).toContain("polos-long-sleeve");
    expect(fallbackCategorySlugs("Performance L/S Polo")).toContain("polos");
     // Baseball/raglan tees stay in the short-sleeve default (product
    // decision, not a bug) even though they're technically 3/4-sleeve.
    expect(fallbackCategorySlugs("ATC EuroSpun Ring Spun Baseball Tee")).toContain("short-sleeve");
  });

  it("does not leak short-sleeve garments into Pants & Shorts", () => {
    // Found via a full-catalog audit after the sleeve-length bug: the bare
    // "short(s)" catch-all for the Shorts department matched the word
    // "Short" inside "Short Sleeve" on tees and polos, wrongly filing them
    // into Pants & Shorts too. Pre-existing, not introduced by the
    // sleeve-length fix.
    expect(fallbackCategorySlugs("Ultra Cotton Short Sleeve Tee")).not.toContain("shorts");
    expect(fallbackCategorySlugs("Classic Pique Short Sleeve Polo")).not.toContain("shorts");
    // Actual shorts must still match.
    expect(fallbackCategorySlugs("Cargo Shorts")).toContain("shorts");
    expect(fallbackCategorySlugs("Basketball Shorts")).toContain("shorts");
  });

  it("does not leak non-apparel fleece products into Hoodies & Sweatshirts", () => {
    // Same audit: the bare "fleece" match in the Hoodies & Sweatshirts
    // catch-all had no apparel-context guard, so a fleece blanket (not
    // apparel at all) was also getting tagged into that department.
    expect(fallbackCategorySlugs("Fleece Blanket")).not.toContain("hoodies-sweatshirts");
    expect(fallbackCategorySlugs("Fleece Blanket")).toContain("blankets");
    // A fleece jacket/vest keeps its intentional secondary tag into
    // Hoodies & Sweatshirts alongside Jackets/Vests -- only the non-apparel
    // leak was the bug.
    expect(fallbackCategorySlugs("Fleece Jacket")).toContain("hoodies-sweatshirts");
    expect(fallbackCategorySlugs("Fleece Jacket")).toContain("jackets");
    expect(fallbackCategorySlugs("Plain Fleece Pullover")).toContain("hoodies-sweatshirts");
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
      "hoodies-sweatshirts",
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
