/**
 * Old WordPress slugs that should keep the URL in the address bar while
 * rendering an existing shop page. Ranking stays on the preserved path
 * because those pages already set canonical to this slug.
 */
export const CONTENT_REWRITES: Record<string, string> = {
  "/faqs": "/faq",
  "/support": "/contact",
  "/shipping-delivery": "/shipping",
  "/privacy-policy": "/privacy",
  "/shop": "/products",
  "/catalogue": "/products",
  "/customer-service": "/contact",
  "/get-a-quote": "/quote",
  "/about-us-great-west-graphics": "/about",
  "/contact-us": "/contact",
};

export function contentRewrites(): Array<{ source: string; destination: string }> {
  return Object.entries(CONTENT_REWRITES).map(([source, destination]) => ({
    source,
    destination,
  }));
}
