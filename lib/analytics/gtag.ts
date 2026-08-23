/**
 * Existing GA4 property only — do not create a new Measurement ID.
 * GreatWestGraphics · account 267559730 / property 374646781.
 */
export const GA4_MEASUREMENT_ID = "G-0M446YCNS9";

/** Event names wired in the App Router shop. Mark these as key events in GA4 Admin. */
export const GA4_EVENTS = {
  contact: "ads_conversion_Contact_Us_1",
  addToCart: "Shopping_Cart_1",
  checkout: "Checkout_1",
  purchase: "purchase",
  tel: "tel",
  mailto: "mailto",
} as const;

export type Ga4EventName = (typeof GA4_EVENTS)[keyof typeof GA4_EVENTS];

export type GtagEventParams = {
  [key: string]: string | number | boolean | undefined;
};

export function classifyContactHref(href: string): "tel" | "mailto" | null {
  const value = href.trim().toLowerCase();
  if (value.startsWith("tel:")) return "tel";
  if (value.startsWith("mailto:")) return "mailto";
  return null;
}

/**
 * Safe `gtag('event', …)` — no-ops on the server and when the official
 * `@next/third-parties` snippet has not installed `window.gtag` yet.
 */
export function sendGtagEvent(
  name: Ga4EventName,
  params?: GtagEventParams,
): boolean {
  if (typeof window === "undefined") return false;
  const gtag = window.gtag;
  if (typeof gtag !== "function") return false;
  gtag("event", name, params);
  return true;
}

export function trackContactSubmit(params?: GtagEventParams): boolean {
  return sendGtagEvent(GA4_EVENTS.contact, params);
}

export function trackAddToCart(params?: GtagEventParams): boolean {
  return sendGtagEvent(GA4_EVENTS.addToCart, {
    currency: "CAD",
    ...params,
  });
}

export function trackCartItemAdded(item: {
  id: string;
  productId?: string;
  name: string;
  qty: number;
  unit: number;
}): boolean {
  return trackAddToCart({
    item_id: item.productId ?? item.id,
    item_name: item.name,
    quantity: item.qty,
    value: Number((item.qty * item.unit).toFixed(2)),
    currency: "CAD",
  });
}

export function trackBeginCheckout(params?: GtagEventParams): boolean {
  return sendGtagEvent(GA4_EVENTS.checkout, {
    currency: "CAD",
    ...params,
  });
}

export function trackPurchase(params: {
  transaction_id: string;
  value?: number;
  currency?: string;
}): boolean {
  return sendGtagEvent(GA4_EVENTS.purchase, {
    currency: params.currency ?? "CAD",
    transaction_id: params.transaction_id,
    value: params.value,
  });
}

export function trackContactLinkClick(href: string): boolean {
  const kind = classifyContactHref(href);
  if (!kind) return false;
  return sendGtagEvent(kind, {
    link_url: href,
    link_type: kind,
  });
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
