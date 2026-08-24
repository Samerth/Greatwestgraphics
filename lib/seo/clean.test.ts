import { describe, expect, it } from "vitest";
import { cleanSeoText, isProductWidgetCopy } from "./clean";
import { GWG_PHONE_DISPLAY } from "./phone";

describe("cleanSeoText", () => {
  it("normalizes phone variants and strips CMS bookmarks", () => {
    expect(cleanSeoText('Call 604 321 3285 <span data-mce-type="bookmark">')).toBe(
      `Call ${GWG_PHONE_DISPLAY}`,
    );
    expect(cleanSeoText("Call 604-331-3285")).toBe(`Call ${GWG_PHONE_DISPLAY}`);
  });

  it("treats WooCommerce widget leftovers as shop teasers, not article copy", () => {
    expect(isProductWidgetCopy("Add to cart")).toBe(true);
    expect(isProductWidgetCopy("Best sellers this week")).toBe(true);
    expect(isProductWidgetCopy("WooCommerce product widget")).toBe(true);
    expect(isProductWidgetCopy("Screen printing for Twin Falls")).toBe(false);
  });
});
