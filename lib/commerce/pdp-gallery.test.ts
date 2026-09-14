import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const gallery = stripComments(read("components/pdp/PdpImageGallery.tsx"));

/**
 * Client feedback, 10 September: "Product images to have arrow to cycle
 * through photos."
 *
 * Arrows already existed inside the full-screen lightbox. The inline gallery
 * offered thumbnails only, which work but read as labels rather than
 * controls, so a shopper who never clicks the photo never discovers the other
 * angles.
 */
describe("inline product gallery cycling", () => {
  it("offers previous and next arrows on the image itself", () => {
    expect(gallery).toContain('aria-label="Previous image"');
    expect(gallery).toContain('aria-label="Next image"');
    expect(gallery).toContain("ChevronLeft");
    expect(gallery).toContain("ChevronRight");
  });

  it("shows the arrows outside the enlarge button, not nested inside it", () => {
    // A button inside a button is invalid markup and the inner one stops
    // receiving clicks, so the arrows must be siblings of the image button.
    const enlargeClose = gallery.indexOf("</button>");
    const firstArrow = gallery.indexOf('aria-label="Previous image"');
    expect(firstArrow).toBeGreaterThan(enlargeClose);
  });

  it("keeps the arrows visible rather than revealing them on hover", () => {
    // Hover-only controls do not exist on a touch device. Checked against the
    // arrow buttons' own classes only — the "Click to enlarge" hint beside
    // them is deliberately hover-revealed and must not be caught here.
    const arrowClasses = [...gallery.matchAll(/step\((-?1)\)\}[\s\S]{0,120}?className="([^"]+)"/g)]
      .map((match) => match[2]!);
    expect(arrowClasses.length).toBeGreaterThanOrEqual(2);
    for (const cls of arrowClasses) {
      expect(cls, "arrow control should not be hover-only").not.toMatch(/opacity-0/);
    }
  });

  it("tells the shopper where they are in the set", () => {
    expect(gallery).toContain("{activeIndex + 1} / {usable.length}");
  });

  it("hides the arrows when there is only one image", () => {
    expect(gallery).toMatch(/usable\.length > 1 && \(\s*<>/);
  });

  it("wraps at both ends rather than dead-ending", () => {
    expect(gallery).toContain("(((prev + delta) % count) + count) % count");
  });

  it("shares one cycling helper with the lightbox and the keyboard", () => {
    // Three call sites - inline arrows, lightbox arrows, arrow keys - must
    // not drift apart into separate implementations.
    expect(gallery.match(/step\((-?1)\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(gallery).not.toMatch(/setActive\(\(prev\) => \(prev \+ 1\) % usable\.length\)/);
  });

  it("clamps the active index so a shorter image list cannot break it", () => {
    // Changing colourway can shorten the list while the index points past it.
    expect(gallery).toContain("const activeIndex = Math.min(active");
    expect(gallery).toContain("index === activeIndex");
  });

  it("memoises the helper so the key listener is not rebound every render", () => {
    expect(gallery).toContain("useCallback");
    expect(gallery).toContain("}, [lightboxOpen, step]);");
  });
});
