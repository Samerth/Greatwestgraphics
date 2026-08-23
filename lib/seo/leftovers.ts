/**
 * Inventoried WordPress URLs that are not in the 154 + 37 + 3 keep-list.
 * Each 301s to the closest relevant live page — never the homepage.
 */
export const LEFTOVER_REDIRECTS: Record<string, string> = {
  "/clothes-printing-and-embroidery-abbotsford":
    "/embroidery-service-in-abbotsford",
  "/custom-jackets": "/custom-printed-jackets-vancouver",
  "/custom-sweatshirts": "/custom-sweatshirts-and-hoodies-vancouver",
  "/screen-printing": "/decoration-processes/custom-screen-printing",
  "/t-shirt-printing-design": "/tshirts-designs-vancouver",
  "/printed-sweatshirts": "/custom-sweatshirts-and-hoodies-vancouver",
  "/tshirt-design": "/tshirts-designs-vancouver",
  "/silk-screen-printing-and-embroidery-pocatello":
    "/screen-printing-and-embroidery-boise",
  "/custom-embroidery-and-printing-port-coquitlam":
    "/custom-t-shirt-printing-coquitlam",
  "/custom-printing-in-delta-rush-service": "/embroidery-service-in-delta",
  "/screen-printing-and-embroidery-burnaby": "/screen-printing-in-burnaby",
  "/dtf-garments-printing-surrey": "/custom-printing-surrey",
  "/custom-printing-tshits-and-embroidery-richmond-great-west-graphics":
    "/custom-printing-richmond",
  "/top-reasons-to-order-custom-t-shirts": "/custom-t-shirts",
  "/t-shits-screen-printing":
    "/decoration-processes/custom-screen-printing",
  "/t-shirt-printing-north-vancouver": "/custom-t-shirts-vancouver",
  "/custom-promotional-items": "/promotional-items-near-me",
  "/screen-printing-vs-custom-embroidery": "/decoration-processes",
  "/custom-screen-printing-for-promotional-apparel-what-are-the-benefits":
    "/decoration-processes/custom-screen-printing",
  "/screen-printed-t-shirts-shop": "/custom-t-shirts",
  "/t-shirt-screen-printing-t-shirts-printing":
    "/t-shirt-screen-printing-vancouver",
  "/embroidery-service-in-langley": "/rush-embroidery-service-in-langley",
  "/woven-label": "/services",
  "/how-to-print-custom-t-shirts": "/how-to-order",
  "/where-to-buy-custom-t-shirts-in-vancouver": "/custom-t-shirts-vancouver",
  "/t-shirt-printing-surrey-great-west-graphics":
    "/t-shirt-printing-in-surrey",
  "/slider/rush-orders": "/rush-t-shirts-printing",
  "/pd_template/t-shirt": "/custom-t-shirts",
  "/faq/can-i-get-free-shipping": "/faqs",
  "/faq/where-can-you-ship-to": "/faqs",
  "/faq/what-are-your-hours-of-operation": "/faqs",
  "/faq/can-i-organize-a-carrier-to-pick-up-my-package": "/faqs",
  "/faq/do-you-offer-discounts": "/faqs",
  "/faq/do-you-do-colour-matching": "/faqs",
  "/faq/what-is-a-vectorized-file-vs-rasterized-file": "/faqs",
  "/faq/how-many-products-can-i-add-to-the-merchandise-store": "/faqs",
  "/faq/how-does-a-merchandise-store-work": "/faqs",
  "/faq/can-i-create-a-merchandise-store": "/faqs",
  "/faq/can-you-guys-do-drop-shipping": "/faqs",
};

/**
 * WordPress-only prefix leftovers. Do not add `/product/:path*`,
 * `/products/:path*`, `/category/:path*`, `/quote/:path*`, `/design/:path*`,
 * `/cart/:path*`, `/checkout/:path*`, `/account/:path*`, `/admin/:path*`,
 * `/api/:path*`, `/store/:path*`, or `/studio/:path*` — those are live app
 * routes. These patterns are not registered in next.config; keep them unused
 * unless a source is proven WordPress-only and disjoint from the app.
 */
export const PREFIX_REDIRECTS: Array<{
  source: string;
  destination: string;
}> = [
  { source: "/faq/:slug", destination: "/faqs" },
  { source: "/product-category/:path*", destination: "/products" },
  { source: "/product-tag/:path*", destination: "/products" },
  { source: "/tag/:path*", destination: "/blogs-screen-printing" },
  { source: "/author/:path*", destination: "/about-us-great-west-graphics" },
  { source: "/slider/:path*", destination: "/rush-t-shirts-printing" },
  { source: "/pd_template/:path*", destination: "/custom-t-shirts" },
];
