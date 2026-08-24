import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyContactHref,
  contactConversionEvents,
  contactClickEvent,
  GA4_EMAIL_CLICK_EVENT,
  GA4_LEAD_EVENT,
  GA4_MEASUREMENT_ID,
  GA4_PHONE_CLICK_EVENT,
  generateLeadEvent,
  sendGtagEvent,
  trackContactClick,
} from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GA4 helpers", () => {
  it("reuses the existing Measurement ID", () => {
    expect(GA4_MEASUREMENT_ID).toBe("G-0M446YCNS9");
    const snippet = readFileSync(
      resolve(process.cwd(), "components/seo/GoogleAnalytics.tsx"),
      "utf8",
    );
    expect(snippet).toContain("googletagmanager.com/gtag/js");
    expect(snippet).toContain("GA4_MEASUREMENT_ID");
  });

  it("classifies tel: and mailto: and ignores other hrefs", () => {
    expect(classifyContactHref("tel:+16043213285")).toBe("phone");
    expect(classifyContactHref("TEL:604-321-3285")).toBe("phone");
    expect(classifyContactHref("mailto:info@greatwestgraphics.com")).toBe(
      "email",
    );
    expect(
      classifyContactHref("mailto:info@greatwestgraphics.com?subject=Quote"),
    ).toBe("email");
    expect(classifyContactHref("/contact")).toBeNull();
    expect(classifyContactHref("https://www.greatwestgraphics.com")).toBeNull();
  });

  it("builds click + generate_lead events for conversions", () => {
    const phone = contactConversionEvents("phone", "tel:+16043213285");
    expect(phone.map((event) => event.name)).toEqual([
      GA4_PHONE_CLICK_EVENT,
      GA4_LEAD_EVENT,
    ]);
    expect(contactClickEvent("phone", "tel:+16043213285").params).toMatchObject({
      method: "phone",
      link_type: "tel",
    });
    expect(
      generateLeadEvent("email", "mailto:info@greatwestgraphics.com").params,
    ).toMatchObject({
      method: "email",
      link_type: "mailto",
    });
    expect(
      contactConversionEvents("email", "mailto:info@greatwestgraphics.com").map(
        (event) => event.name,
      ),
    ).toEqual([GA4_EMAIL_CLICK_EVENT, GA4_LEAD_EVENT]);
  });

  it("sends gtag events when the global is present", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    trackContactClick("phone", "tel:+16043213285");
    expect(gtag).toHaveBeenCalledWith(
      "event",
      GA4_PHONE_CLICK_EVENT,
      expect.objectContaining({ method: "phone" }),
    );
    expect(gtag).toHaveBeenCalledWith(
      "event",
      GA4_LEAD_EVENT,
      expect.objectContaining({ method: "phone" }),
    );
    expect(sendGtagEvent(GA4_EMAIL_CLICK_EVENT, {
      method: "email",
      link_url: "mailto:info@greatwestgraphics.com",
      link_type: "mailto",
    })).toBe(true);
  });

  it("no-ops when gtag is missing", () => {
    vi.stubGlobal("window", {});
    expect(
      sendGtagEvent(GA4_PHONE_CLICK_EVENT, {
        method: "phone",
        link_url: "tel:+16043213285",
        link_type: "tel",
      }),
    ).toBe(false);
  });
});
