import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyContactHref,
  GA4_EVENTS,
  GA4_MEASUREMENT_ID,
  sendGtagEvent,
  trackAddToCart,
  trackBeginCheckout,
  trackCartItemAdded,
  trackContactLinkClick,
  trackContactSubmit,
  trackPurchase,
} from "./gtag";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GA4 gtag helper", () => {
  it("reuses the existing Measurement ID", () => {
    expect(GA4_MEASUREMENT_ID).toBe("G-0M446YCNS9");
  });

  it("exports the conversion event names used in code", () => {
    expect(GA4_EVENTS).toEqual({
      contact: "ads_conversion_Contact_Us_1",
      addToCart: "Shopping_Cart_1",
      checkout: "Checkout_1",
      purchase: "purchase",
      tel: "tel",
      mailto: "mailto",
    });
  });

  it("classifies tel: and mailto: and ignores other hrefs", () => {
    expect(classifyContactHref("tel:+16043213285")).toBe("tel");
    expect(classifyContactHref("TEL:604-321-3285")).toBe("tel");
    expect(classifyContactHref("mailto:info@greatwestgraphics.com")).toBe(
      "mailto",
    );
    expect(
      classifyContactHref("mailto:info@greatwestgraphics.com?subject=Quote"),
    ).toBe("mailto");
    expect(classifyContactHref("/contact")).toBeNull();
    expect(classifyContactHref("https://www.greatwestgraphics.com")).toBeNull();
  });

  it("sends gtag events when the global is present", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });

    expect(trackContactSubmit({ method: "contact_form" })).toBe(true);
    expect(trackAddToCart({ item_name: "Tee", quantity: 24, value: 240 })).toBe(
      true,
    );
    expect(
      trackCartItemAdded({
        id: "tee",
        productId: "prod-1",
        name: "Tee",
        qty: 24,
        unit: 10,
      }),
    ).toBe(true);
    expect(trackBeginCheckout({ value: 252 })).toBe(true);
    expect(
      trackPurchase({
        transaction_id: "JR-1001",
        value: 252,
        currency: "CAD",
      }),
    ).toBe(true);
    expect(trackContactLinkClick("tel:+16043213285")).toBe(true);
    expect(trackContactLinkClick("mailto:info@greatwestgraphics.com")).toBe(
      true,
    );

    expect(gtag).toHaveBeenCalledWith(
      "event",
      "ads_conversion_Contact_Us_1",
      expect.objectContaining({ method: "contact_form" }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "Shopping_Cart_1",
      expect.objectContaining({ currency: "CAD", quantity: 24 }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "Shopping_Cart_1",
      expect.objectContaining({
        item_id: "prod-1",
        item_name: "Tee",
        value: 240,
      }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "Checkout_1",
      expect.objectContaining({ currency: "CAD", value: 252 }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "purchase",
      expect.objectContaining({
        transaction_id: "JR-1001",
        value: 252,
        currency: "CAD",
      }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "tel",
      expect.objectContaining({ link_type: "tel" }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "mailto",
      expect.objectContaining({ link_type: "mailto" }),
    );
  });

  it("does not throw when gtag is missing", () => {
    vi.stubGlobal("window", {});
    expect(() =>
      sendGtagEvent(GA4_EVENTS.purchase, { transaction_id: "x" }),
    ).not.toThrow();
    expect(sendGtagEvent(GA4_EVENTS.tel, { link_url: "tel:+16043213285" })).toBe(
      false,
    );
    expect(trackContactLinkClick("tel:+16043213285")).toBe(false);
    expect(trackAddToCart({ item_name: "Tee" })).toBe(false);
  });

  it("does not throw when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackPurchase({ transaction_id: "x" })).not.toThrow();
    expect(sendGtagEvent(GA4_EVENTS.checkout)).toBe(false);
  });
});
