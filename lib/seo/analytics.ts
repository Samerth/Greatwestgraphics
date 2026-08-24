/**
 * Existing GA4 property only — do not create a new Measurement ID.
 * Spec §4: same gtag.js snippet on every page, G-0M446YCNS9.
 */
export const GA4_MEASUREMENT_ID = "G-0M446YCNS9";

/** Custom events to mark as key events in GA4 Admin (see docs/seo/migration.md). */
export const GA4_PHONE_CLICK_EVENT = "phone_click";
export const GA4_EMAIL_CLICK_EVENT = "email_click";

/**
 * Recommended GA4 conversion event. Fired alongside the click events so
 * Admin → Events can mark it as a key event without inventing a new property.
 */
export const GA4_LEAD_EVENT = "generate_lead";

export type ContactClickKind = "phone" | "email";

export type GtagEvent = {
  name: string;
  params: {
    method: ContactClickKind;
    link_url: string;
    link_type: "tel" | "mailto";
  };
};

export function classifyContactHref(href: string): ContactClickKind | null {
  const value = href.trim().toLowerCase();
  if (value.startsWith("tel:")) return "phone";
  if (value.startsWith("mailto:")) return "email";
  return null;
}

export function contactClickEvent(
  kind: ContactClickKind,
  href: string,
): GtagEvent {
  return {
    name: kind === "phone" ? GA4_PHONE_CLICK_EVENT : GA4_EMAIL_CLICK_EVENT,
    params: {
      method: kind,
      link_url: href,
      link_type: kind === "phone" ? "tel" : "mailto",
    },
  };
}

export function generateLeadEvent(
  kind: ContactClickKind,
  href: string,
): GtagEvent {
  return {
    name: GA4_LEAD_EVENT,
    params: {
      method: kind,
      link_url: href,
      link_type: kind === "phone" ? "tel" : "mailto",
    },
  };
}

/** Both the specific click event and the recommended conversion event. */
export function contactConversionEvents(
  kind: ContactClickKind,
  href: string,
): GtagEvent[] {
  return [contactClickEvent(kind, href), generateLeadEvent(kind, href)];
}

export function sendGtagEvent(
  name: string,
  params: GtagEvent["params"],
): boolean {
  if (typeof window === "undefined") return false;
  const gtag = window.gtag;
  if (typeof gtag !== "function") return false;
  gtag("event", name, params);
  return true;
}

export function trackContactClick(kind: ContactClickKind, href: string): void {
  for (const event of contactConversionEvents(kind, href)) {
    sendGtagEvent(event.name, event.params);
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
