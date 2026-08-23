import { describe, expect, it } from "vitest";
import { containsBannedPhone } from "./clean";
import { CONTENT_PAGES } from "./content-pages";
import records from "./data/location-pages.json";
import { locationSections, LOCATION_PAGES } from "./location-pages";
import { GWG_PHONE_DISPLAY } from "./phone";
import { uniqueThinSections } from "./thin-copy";

const RAW_JSON = JSON.stringify(records);

const SPEC_THIN = [
  "/screen-printing-and-embroidery-twin-falls",
  "/screen-printing-and-embroidery-nampa",
  "/screen-printing-and-embroidery-swift-current",
  "/screen-printing-and-embroidery-sherbrooke",
  "/screen-printing-and-embroidery-richland",
  "/screen-printing-and-embroidery-idaho-falls",
  "/t-shirt-design-richmond",
  "/t-shirt-design-vancouver",
  "/custom-screen-printing-everett",
  "/screen-printing-delta-free-shipping",
  "/screen-printing-in-saskatoon",
  "/screen-printing-medicine-hat",
  "/screen-printing-prince-albert",
  "/custom-t-shirt-printing-maple-ridge",
];

describe("content QA", () => {
  it("does not carry the Maple Ridge phone typo forward", () => {
    expect(containsBannedPhone(RAW_JSON)).toBe(false);
    expect(GWG_PHONE_DISPLAY).toBe("604-321-3285");
    for (const page of LOCATION_PAGES) {
      const blob = [page.title, page.description, page.h1, ...locationSections(page).flatMap((s) => s.paragraphs)].join("\n");
      expect(containsBannedPhone(blob), page.path).toBe(false);
      expect(blob).not.toContain("Contact form not found");
      expect(blob).not.toContain("data-mce-type");
    }
    const maple = LOCATION_PAGES.find(
      (page) => page.path === "/embroidery-service-in-maple-ridge",
    );
    expect(maple).toBeTruthy();
    const mapleCopy = locationSections(maple!).flatMap((s) => s.paragraphs).join(" ");
    expect(mapleCopy).toContain(GWG_PHONE_DISPLAY);
  });

  it("gives every thin spec page a unique H1 and unique lead paragraph", () => {
    const leads = new Set<string>();
    const h1s = new Set<string>();
    for (const path of SPEC_THIN) {
      const page = LOCATION_PAGES.find((row) => row.path === path);
      expect(page, path).toBeTruthy();
      expect(page!.h1.length).toBeGreaterThan(8);
      expect(h1s.has(page!.h1), page!.h1).toBe(false);
      h1s.add(page!.h1);
      const lead = uniqueThinSections(page!)[0]?.paragraphs[0] ?? "";
      expect(lead.length).toBeGreaterThan(80);
      expect(leads.has(lead), path).toBe(false);
      leads.add(lead);
    }
  });

  it("strips CMS junk from titles and the White Rock leak", () => {
    const masks = LOCATION_PAGES.find((page) => page.path === "/custom-masks-in-burnaby");
    expect(masks?.title).not.toMatch(/-{3,}|%%/);
    const whiteRock = LOCATION_PAGES.find(
      (page) => page.path === "/screen-printing-in-white-rock",
    );
    const copy = locationSections(whiteRock!).flatMap((s) => [
      s.heading ?? "",
      ...s.paragraphs,
    ]);
    expect(copy.some((line) => /custom embroidery in coquitlam/i.test(line))).toBe(
      false,
    );
  });

  it("keeps exactly one H1 string on every location and content page record", () => {
    for (const page of [...LOCATION_PAGES, ...CONTENT_PAGES]) {
      expect(page.h1.split("\n").length).toBe(1);
      expect(page.h1.length).toBeGreaterThan(0);
    }
  });
});
