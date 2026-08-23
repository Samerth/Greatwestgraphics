import { canonicalizePath } from "./paths";

export type ContentReuse =
  | "faq"
  | "about"
  | "contact"
  | "shipping"
  | "privacy"
  | "products"
  | "quote";

export type ContentMode = "reuse" | "landing" | "flag";

export type ContentPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  mode: ContentMode;
  reuse?: ContentReuse;
  /** When set, this URL consolidates to another preserved slug. */
  canonicalPath?: string;
  categorySlug?: string | null;
  method?: string | null;
  service?: string;
  indexable?: boolean;
  intro?: string;
};

/**
 * Section 2b (37) plus section 2f (3 flagged). Reuse rows render the existing
 * shop page at the WordPress path. Landing rows stay short and point into
 * /products, /quote, /design and /contact — they do not replay the old essays.
 */
export const CONTENT_PAGES: ContentPage[] = [
  {
    path: "/faqs",
    title: "FAQ - Great West Graphics",
    description:
      "Ordering, artwork, print methods, shipping and account support — answers from the Great West Graphics production floor.",
    h1: "Frequently Asked Questions",
    mode: "reuse",
    reuse: "faq",
  },
  {
    path: "/support",
    title: "Support - Great West Graphics",
    description:
      "Talk to the Great West Graphics team in Vancouver about an order, a proof, or a production question.",
    h1: "Support",
    mode: "reuse",
    reuse: "contact",
  },
  {
    path: "/shipping-delivery",
    title: "Shipping & Delivery - Great West Graphics",
    description:
      "Pickup in Vancouver, Metro Vancouver courier, and tracked shipping across Canada and the United States.",
    h1: "From our floor to your door.",
    mode: "reuse",
    reuse: "shipping",
  },
  {
    path: "/privacy-policy",
    title: "Privacy Policy - Great West Graphics",
    description:
      "What Great West Graphics collects when you request a quote, save a design or create an account, and how to ask for a copy or its deletion.",
    h1: "What we collect, and why.",
    mode: "reuse",
    reuse: "privacy",
  },
  {
    path: "/shop",
    title: "Shop - Great West Graphics",
    description:
      "Browse custom apparel and promotional products — screen printed or embroidered in Vancouver.",
    h1: "Shop All Products",
    mode: "reuse",
    reuse: "products",
  },
  {
    path: "/catalogue",
    title: "Catalogue - Great West Graphics",
    description:
      "The Great West Graphics product catalogue — apparel, headwear, bags, outerwear and more.",
    h1: "Shop All Products",
    mode: "reuse",
    reuse: "products",
  },
  {
    path: "/customer-service",
    title: "Customer Service - Great West Graphics",
    description:
      "Contact Great West Graphics in Vancouver for help with a quote, a proof, or an order in production.",
    h1: "Customer Service",
    mode: "reuse",
    reuse: "contact",
  },
  {
    path: "/get-a-quote",
    title: "Get a Quote - Great West Graphics",
    description:
      "Build a live custom print quote — choose a product, quantity and decoration method and see estimated pricing.",
    h1: "Build a better print quote.",
    mode: "reuse",
    reuse: "quote",
  },
  {
    path: "/about-us-great-west-graphics",
    title: "About Us - Great West Graphics",
    description:
      "Great West Graphics has been screen printing and embroidering in Vancouver since 1980.",
    h1: "46 years on the print floor.",
    mode: "reuse",
    reuse: "about",
  },
  {
    path: "/contact-us",
    title: "Contact Us - Great West Graphics",
    description:
      "Talk to the Great West Graphics print floor in Vancouver. Share your product, quantity and deadline.",
    h1: "Contact Us",
    mode: "reuse",
    reuse: "contact",
  },
  {
    path: "/services",
    title: "Services - Great West Graphics",
    description:
      "Screen printing, embroidery, DTF and sublimation from our Vancouver production floor.",
    h1: "Print and embroidery services",
    mode: "landing",
    service: "Custom printing",
    intro:
      "We decorate apparel and promotional products in-house in Vancouver — screen printing, embroidery, DTF and sublimation. Pick a method, or start with a quote and we will recommend one.",
  },
  {
    path: "/gallery",
    title: "Gallery - Great West Graphics",
    description:
      "Recent custom apparel and print work from the Great West Graphics floor in Vancouver.",
    h1: "Our work",
    mode: "landing",
    service: "Custom printing",
    intro:
      "A short look at garments and prints that have gone through our Vancouver shop. Start a similar order from the catalogue or the design studio.",
  },
  {
    path: "/rush-t-shirts-printing",
    title: "Rush T-Shirt Printing - Great West Graphics",
    description:
      "Rush t-shirt printing from Vancouver when the event date does not move.",
    h1: "Rush t-shirt printing",
    mode: "landing",
    service: "Rush t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Need shirts before a game, a fundraiser or a staff event? Tell us the in-hands date and we will confirm whether a rush or same-day run will make it.",
  },
  {
    path: "/signs-and-displays",
    title: "Signs and Displays - Great West Graphics",
    description:
      "Banners, tablecloths and display printing from Great West Graphics in Vancouver.",
    h1: "Signs and displays",
    mode: "landing",
    service: "Signs and displays",
    intro:
      "Banners, table covers and event displays printed with the same in-house process we use for apparel. Send the size, quantity and date for a quote.",
  },
  {
    path: "/t-shirt-printing-rush-orders",
    title: "T-Shirt Printing Rush Orders - Great West Graphics",
    description:
      "Rush-order t-shirt printing from Great West Graphics in Vancouver.",
    h1: "T-shirt printing rush orders",
    mode: "landing",
    service: "Rush t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Rush t-shirt orders are quoted against the real press calendar, not a generic timer. Include your date when you request a quote or call the shop.",
  },
  {
    path: "/t-shirts-printing-canada",
    title: "T-Shirt Printing Canada - Great West Graphics",
    description:
      "Custom t-shirt printing in Vancouver with shipping across Canada.",
    h1: "T-shirt printing across Canada",
    mode: "landing",
    service: "Custom t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Orders are printed in Vancouver and shipped across Canada. Choose a blank from the catalogue or send a quote with your quantity and artwork.",
  },
  {
    path: "/tee-shirt-printing",
    title: "Tee Shirt Printing - Great West Graphics",
    description:
      "Custom tee shirt printing — screen printed or embroidered in Vancouver.",
    h1: "Tee shirt printing",
    mode: "landing",
    service: "Custom t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Crews, V-necks and athletic tees from the live catalogue, decorated in Vancouver. Start in the shop or the design studio.",
  },
  {
    path: "/spirit-wear-for-schools",
    title: "Spirit Wear for Schools - Great West Graphics",
    description:
      "School spirit wear — custom tees, hoodies and headwear printed in Vancouver.",
    h1: "Spirit wear for schools",
    mode: "landing",
    service: "School spirit wear",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Team and school orders for tees, hoodies and hats, proofed before they hit the press. Roster names and numbers can go on the quote.",
  },
  {
    path: "/grad-wear-for-schools",
    title: "Grad Wear for Schools - Great West Graphics",
    description:
      "Custom grad apparel for schools — printed and embroidered in Vancouver.",
    h1: "Grad wear for schools",
    mode: "landing",
    service: "Grad wear",
    categorySlug: "hoodies-and-crewnecks",
    method: "screen",
    intro:
      "Hoodies, tees and hats for graduation events. Send the date, colours and quantity and we will plan production around it.",
  },
  {
    path: "/how-to-order",
    title: "How to Order - Great West Graphics",
    description:
      "How to order custom print and embroidery from Great West Graphics.",
    h1: "How to order",
    mode: "landing",
    service: "Custom printing",
    intro:
      "Pick a garment, add your art in the design studio or send a file, approve the proof, and we print. A quote is the fastest way to lock quantity and timing.",
  },
  {
    path: "/orders-and-returns",
    title: "Orders and Returns - Great West Graphics",
    description:
      "How Great West Graphics handles reprints and damaged orders.",
    h1: "Orders and returns",
    mode: "landing",
    service: "Custom printing",
    intro:
      "Every order is proofed before it prints. If a job arrives misprinted, mismatched or damaged, send photos and the order number and we will arrange a reprint or refund per the quality guarantee.",
  },
  {
    path: "/great-west-graphics-guarantee",
    title: "Great West Graphics Guarantee",
    description:
      "We reprint our mistakes. Proofs go out before a single sheet runs.",
    h1: "Our guarantee",
    mode: "landing",
    service: "Custom printing",
    intro:
      "We reprint our mistakes, free. You approve a digital proof before production, and the floor checks the run before it ships.",
  },
  {
    path: "/printed-t-shirts-and-hoodies",
    title: "Printed T-Shirts and Hoodies - Great West Graphics",
    description:
      "Custom printed t-shirts and hoodies from Great West Graphics in Vancouver.",
    h1: "Printed t-shirts and hoodies",
    mode: "landing",
    service: "Custom apparel",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Tees and fleece from the live catalogue, screen printed or embroidered in Vancouver. Filter the shop or start a quote with both garments on one job.",
  },
  {
    path: "/promotional-items-near-me",
    title: "Promotional Items Near Me - Great West Graphics",
    description:
      "Promotional products from Great West Graphics in Vancouver — drinkware, bags, writing and event items.",
    h1: "Promotional items",
    mode: "landing",
    service: "Promotional products",
    intro:
      "Promo items ship from the same Vancouver shop as the apparel. Ask us to source a specific item if it is not in the catalogue.",
  },
  {
    path: "/sale-for-printed-and-embroidered-hoodies",
    title: "Printed and Embroidered Hoodies - Great West Graphics",
    description:
      "Custom printed and embroidered hoodies from Great West Graphics in Vancouver.",
    h1: "Printed and embroidered hoodies",
    mode: "landing",
    service: "Custom hoodies",
    categorySlug: "hoodies-and-crewnecks",
    method: "embroidery",
    intro:
      "Hoodies and crewnecks decorated in-house. Current pricing is on the product and on the quote builder — we do not keep a separate sale catalogue.",
  },
  {
    path: "/blogs-screen-printing",
    title: "Screen Printing Notes - Great West Graphics",
    description:
      "Screen printing process notes from Great West Graphics. The old WordPress blog is not carried onto this site.",
    h1: "Screen printing notes",
    mode: "landing",
    service: "Screen printing",
    method: "screen",
    intro:
      "The previous WordPress blog is not published on this site. Process questions are covered in the FAQ; start a job from the quote builder or the shop.",
  },
  {
    path: "/decoration-processes",
    title: "Decoration Processes - Great West Graphics",
    description:
      "Screen printing, embroidery and other decoration processes at Great West Graphics.",
    h1: "Decoration processes",
    mode: "landing",
    service: "Custom printing",
    intro:
      "Choose the process that matches the garment, the art and the quantity. The quote builder prices the methods we run in-house.",
  },
  {
    path: "/decoration-processes/embroidery",
    title: "Embroidery - Great West Graphics",
    description:
      "Custom embroidery in Vancouver — logos on hats, polos, jackets and fleece.",
    h1: "Embroidery",
    mode: "landing",
    service: "Custom embroidery",
    categorySlug: "hats",
    method: "embroidery",
    intro:
      "Stitched logos on structured garments and headwear. Digitizing is part of the job; you approve a proof before we hoop anything.",
  },
  {
    path: "/decoration-processes/custom-screen-printing",
    title: "Custom Screen Printing - Great West Graphics",
    description:
      "Custom screen printing in Vancouver for bulk apparel runs.",
    h1: "Custom screen printing",
    mode: "landing",
    service: "Screen printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Screen printing is the usual choice for bulk apparel with a limited colour count. We burn screens in-house and dry every print.",
  },
  {
    path: "/custom-t-shirts",
    title: "Custom T-Shirts - Great West Graphics",
    description:
      "Custom t-shirts screen printed or embroidered in Vancouver.",
    h1: "Custom t-shirts",
    mode: "landing",
    service: "Custom t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "The shop lists live blanks from the current catalogue. Design on the garment or send artwork with a quote.",
  },
  {
    path: "/artwork-information-guideline",
    title: "Artwork Information Guideline - Great West Graphics",
    description:
      "Artwork file types and proofing guidelines for Great West Graphics orders.",
    h1: "Artwork guidelines",
    mode: "landing",
    service: "Custom printing",
    intro:
      "We accept AI, EPS, PDF, or high-resolution PNG (300 DPI). If the file is not print-ready, the studio can vectorize a logo. Every order gets a digital proof before press.",
  },
  {
    path: "/bamboo-t-shirts-eco-friendly-comfort",
    title: "Bamboo T-Shirts - Great West Graphics",
    description:
      "Softer-hand and alternative-fibre tees from the Great West Graphics catalogue, decorated in Vancouver.",
    h1: "Bamboo and alternative-fibre tees",
    mode: "landing",
    service: "Custom t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "Search the catalogue for the fibre and brand you want. If a specific bamboo blank is not listed, ask us to source it.",
  },
  {
    path: "/custom-canadian-made-apparel",
    title: "Custom Canadian-Made Apparel - Great West Graphics",
    description:
      "Custom decorated apparel produced in Vancouver, shipped across Canada.",
    h1: "Custom Canadian-made apparel",
    mode: "landing",
    service: "Custom apparel",
    categorySlug: "t-shirts",
    intro:
      "Decoration happens on our Vancouver floor. Blanks come from the North American suppliers in the catalogue; we can source a Canadian-made blank when the job requires it.",
  },
  {
    path: "/safety-products",
    title: "Safety Products - Great West Graphics",
    description:
      "Custom safety apparel and high-visibility wear from Great West Graphics.",
    h1: "Safety products",
    mode: "landing",
    service: "Safety apparel",
    categorySlug: "jackets",
    method: "screen",
    intro:
      "High-visibility vests and workwear, decorated in-house. Ask us to source a specific CSA or ANSI garment if it is not in the shop.",
  },
  {
    path: "/select-brand-of-your-choice",
    title: "Select a Brand - Great West Graphics",
    description:
      "Shop custom apparel by brand in the Great West Graphics catalogue.",
    h1: "Select a brand",
    mode: "landing",
    service: "Custom apparel",
    intro:
      "The catalogue can be filtered by brand on the shop page. If a line you need is missing, ask us to source it.",
  },
  {
    path: "/screen-printed-custom-t-shirts-2",
    title: "Screen Printed Custom T-Shirts - Great West Graphics",
    description:
      "Screen printed custom t-shirts from Great West Graphics in Vancouver.",
    h1: "Screen printed custom t-shirts",
    mode: "landing",
    service: "Screen printed t-shirts",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "This is the live URL for screen-printed custom tees (there is no unsuffixed duplicate). Order from the catalogue or request a quote.",
  },
  {
    path: "/t-shirt-printing-2",
    title: "T-Shirt Printing - Great West Graphics",
    description:
      "Custom t-shirt printing from Great West Graphics in Vancouver.",
    h1: "T-shirt printing",
    mode: "landing",
    service: "Custom t-shirt printing",
    categorySlug: "t-shirts",
    method: "screen",
    intro:
      "This is the live t-shirt printing URL (there is no unsuffixed duplicate). Browse blanks or start a quote.",
  },
  {
    path: "/custom-store-website-builder",
    title: "Team Store Builder - Great West Graphics",
    description: "Start a branded team store with Great West Graphics.",
    h1: "Team stores",
    mode: "flag",
    indexable: false,
    intro:
      "This address is reserved while we confirm whether the old builder page should stay. Create a team store from your account, or contact the shop.",
  },
  {
    path: "/xyz-school",
    title: "School Store - Great West Graphics",
    description: "Great West Graphics school and team stores.",
    h1: "School stores",
    mode: "flag",
    indexable: false,
    intro:
      "This address looked like leftover placeholder content on the previous site. It is held — not dropped — until the client confirms. Use the shop or contact us for a school order.",
  },
  {
    path: "/monthly-specials",
    title: "Monthly Specials - Great West Graphics",
    description:
      "Current pricing is on the product and the quote builder at Great West Graphics.",
    h1: "Current pricing",
    mode: "flag",
    indexable: false,
    intro:
      "The old monthly-specials page was time-sensitive WordPress promo content. Until we confirm it should return, use the live catalogue and quote builder for current pricing.",
  },
];

const BY_PATH = new Map(
  CONTENT_PAGES.map((page) => [canonicalizePath(page.path), page]),
);

export function getContentPage(path: string): ContentPage | undefined {
  return BY_PATH.get(canonicalizePath(path));
}

export function contentCanonicalPath(page: ContentPage): string {
  return page.canonicalPath ?? page.path;
}
