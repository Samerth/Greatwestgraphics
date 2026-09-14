import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const quantityStep = read("components/design/QuantityStep.tsx");
const studio = read("components/design/DesignStudio.tsx");

describe("names/numbers surcharge is actually wired", () => {
  // The fee was defined in pricing config and shown in the UI, but no
  // storefront caller ever passed the flag that applies it, so it was
  // advertised and never charged. Guard the wiring, not just the engine.
  it("passes includeNamesNumbers into the Input Quantity quote", () => {
    expect(quantityStep).toContain("includeNamesNumbers");
  });

  it("only applies it to a fully-named order, never to un-named spares", () => {
    expect(quantityStep).toContain(
      "includeNamesNumbers: namedQty > 0 && spareQty === 0",
    );
  });

  it("tells the customer when a mixed order's fee is not in the estimate", () => {
    expect(quantityStep).toMatch(/not in the estimate above/);
  });
});

describe("the studio asks no ordering questions", () => {
  it("no longer prices, because it has no quantity to price against", () => {
    expect(studio).not.toMatch(/const quoted = useMemo\(/);
    expect(studio).not.toMatch(/\bfunction unitPriceMinor\b/);
    expect(studio).not.toMatch(/\bconst \[designQty\b/);
  });

  it("has no add-to-cart path of its own", () => {
    expect(studio).not.toMatch(/\basync function addDesignToCart\b/);
  });

  it("exits to the Input Quantity step instead", () => {
    expect(studio).toContain("Continue to Quantity");
    expect(studio).toContain("/design/quantity");
  });
});

/**
 * CodSphere UAT V2 rows 56 and 57: the Design Studio is no longer a global
 * header destination. Row 56 removes the persistent "current design" chip
 * ("ATC Everyday Cotton Tee · 2026-09-08") that followed the shopper around
 * the site; row 57 removes the "Design Studio" nav link. Saved work reaches
 * the studio from Account → My Designs, or from a product page.
 */
describe("the studio is not a header destination", () => {
  const header = read("components/layout/Header.tsx");

  it("renders no current-design chip", () => {
    expect(header).not.toContain("ActiveDesignBadge");
  });

  it("has no Design Studio nav link, on desktop or mobile", () => {
    expect(header).not.toContain("PRIMARY_LINKS");
    expect(header).not.toMatch(/href="\/design"/);
    expect(header).not.toMatch(/>\s*Design Studio\s*</);
  });

  it("still offers Account → My Designs as the way back to saved work", () => {
    expect(header).toContain("/portal/designs");
  });

  it("is not a footer destination either", () => {
    // The footer's Services column carried a "Design Studio" link into the
    // bare studio after the header link was removed — the same navigation,
    // one screen lower.
    const footer = read("components/layout/Footer.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(footer).not.toMatch(/href: "\/design"/);
    expect(footer).not.toMatch(/label: "Design Studio"/);
  });

  it("keeps the quote CTA, which row 56 explicitly retains", () => {
    expect(header).toMatch(/Get an instant quote/i);
  });
});

/**
 * Removing the header chip removed the only control that could discard an
 * in-progress design. Without a replacement the saved design would follow the
 * customer as "Continue my design" on every product, permanently.
 */
describe("an in-progress design can still be discarded", () => {
  it("offers a start-over control inside the studio", () => {
    expect(studio).toContain("Start a new design");
    expect(studio).toContain("startNewDesign");
  });

  it("paints the confirm button in a colour the theme actually defines", () => {
    // It was `bg-danger`, which no theme token backs, so the button drew
    // white text on the white panel and the confirmation appeared to offer
    // only "Keep editing" (15 Sep). The codebase has no danger token at all;
    // destructive and error states use Tailwind's red scale directly.
    const confirm = studio.match(
      /<button[^>]*?className="([^"]*)"[^>]*>\s*Discard and start over/,
    );
    expect(confirm, "confirm button not found").not.toBeNull();
    expect(confirm![1]).toMatch(/(?:^| )bg-red-\d{3}(?: |$)/);
    expect(confirm![1]).not.toContain("bg-danger");
  });

  it("uses no undefined danger token anywhere in the studio or checkout", () => {
    for (const file of [
      "components/design/DesignStudio.tsx",
      "components/checkout/TurnaroundStep.tsx",
    ]) {
      const source = read(file).replace(/\/\/.*$/gm, "");
      expect(source, file).not.toMatch(/(?:^|[ "])(?:bg|text|border)-danger(?:[ "]|$)/);
    }
  });

  it("clears the persisted store rather than only the local canvas", () => {
    expect(studio).toMatch(/useActiveDesignStore\.getState\(\)\.clear\(\)/);
  });

  it("confirms first, so one stray click cannot destroy the artwork", () => {
    expect(studio).toContain("confirmingNewDesign");
    expect(studio).toMatch(/Discard this design and start over/);
  });
});

/**
 * Design Studio defects raised by the client on 10 September.
 */
describe("studio canvas interaction", () => {
  const canvas = read("components/design/DesignCanvas.tsx");
  const artworkLayer = read("components/design/ArtworkLayer.tsx");

  it("does not let the guides overlay swallow pointer events", () => {
    // The overlay is absolutely positioned over the whole stage. Without
    // pointer-events-none it intercepts every click and drag before Konva
    // sees them, and artwork cannot be moved at all.
    // Matched on the markup itself rather than on distance from the comment
    // above it, so the assertion survives the comment being reworded.
    expect(studio).toMatch(
      /className="pointer-events-none absolute inset-0"\s*style=\{\{ transform: `scale\(\$\{zoom\}\)` \}\}/,
    );
  });

  it("lets the one interactive control inside that overlay opt back in", () => {
    expect(studio).toContain('className="pointer-events-auto absolute z-[3]');
  });

  it("keeps artwork partly on the canvas while dragging", () => {
    expect(artworkLayer).toContain("dragBoundFunc");
    expect(artworkLayer).toContain("KEEP_ON_CANVAS_PX");
  });

  it("checks position as well as size when resizing", () => {
    // Size was capped before; position was not, so a corner drag could grow
    // artwork straight off the canvas at a legal size.
    expect(artworkLayer).toMatch(/boundBoxFunc[\s\S]{0,600}?offCanvas/);
  });

  it("passes the canvas bound down to the artwork layer", () => {
    expect(canvas).toContain("canvasSize={displaySize}");
  });
});

/**
 * Reported 14 September: opening the Studio for an Aluminum Grey Allmade tee
 * showed a purple model photo until the product detail loaded. The Studio's
 * pre-load backdrop borrowed the catalogue card's image, which row 28 made the
 * on-model style hero — one colourway's photo, standing in for all of them.
 */
describe("the studio starts on the garment's own colour", () => {
  const page = read("app/(shop)/design/page.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("seeds each garment with its colour-specific photo, not the card hero", () => {
    expect(page).toMatch(
      /p\.colorSwatches\.find\(\(swatch\) => swatch\.productId === p\.id\)\?\.imageUrl \?\?\s*p\.imageUrl/,
    );
  });

  it("labels a garment by its title rather than its style code", () => {
    // "Allmade AL2004" in the Studio while the shop says "Allmade Unisex
    // Tri-Blend Tee" — the same name bug, in the one place it was rebuilt.
    expect(studio).toContain("storefrontProductName({");
    expect(studio).not.toMatch(
      /label: `\$\{productDetail\.style\.brandName\} \$\{productDetail\.style\.styleName\}`/,
    );
  });
});

/**
 * Deleting a saved design from My Designs replaced the whole page with
 * "Something went wrong" when it failed (15 Sep). The action threw straight
 * into the portal's error boundary, so whatever the real reason was — the
 * design belonging to a different sign-in, the API being down — the customer
 * never saw it, and neither could anyone diagnosing it.
 */
describe("a failed design delete explains itself", () => {
  const actions = read("app/portal/designs/actions.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const page = read("app/portal/designs/page.tsx");

  it("catches the failure rather than throwing into the error boundary", () => {
    expect(actions).toMatch(/try \{[\s\S]*?deleteDesignProject\(id\)[\s\S]*?\} catch/);
    expect(actions).not.toMatch(/throw new Error\("Sign in to delete/);
  });

  it("sends the real reason back to the list", () => {
    expect(actions).toContain("redirect(`/portal/designs?error=");
    expect(actions).toContain("caught.message");
  });

  it("is shown on the page", () => {
    expect(page).toMatch(/searchParams\)\?\.error/);
  });

  it("sends a signed-out caller to sign in instead of failing", () => {
    expect(actions).toContain('redirect("/account?next=/portal/designs")');
  });
});

/**
 * 15 Sep: an order reached the admin work order with the bare logo file as
 * its "proof" - the studio's mockup export had failed and the artwork file
 * was silently substituted, including into the saved design's proof image.
 */
describe("the proof is the mockup, not the logo", () => {
  const studio = read("components/design/DesignStudio.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("retries the mockup export once before falling back", () => {
    expect(studio).toMatch(
      /mockupUrl = await uploadProofImage\(\);\s*if \(!mockupUrl\) \{\s*await nextFrame\(\);\s*mockupUrl = await uploadProofImage\(\);/,
    );
  });

  it("carries the artwork on the order only as a fallback", () => {
    expect(studio).toContain("const proofUrl = mockupUrl ?? firstDurableArtworkUrl(design) ?? null;");
  });

  it("never saves the bare artwork as a design's proof image", () => {
    // persistDesign skips proofImageUrl when handed null, so an earlier good
    // mockup on the saved design survives a failed export.
    expect(studio).toContain("persistDesign(name, mockupUrl)");
    expect(studio).not.toContain("persistDesign(name, proofUrl)");
    expect(studio).toContain("if (proof) payload.proofImageUrl = proof;");
  });

  it("says so in the console when it happens", () => {
    expect(studio).toMatch(/no mockup could be exported/);
  });
});
