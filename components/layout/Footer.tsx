import Link from "next/link";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import { Container } from "@/components/shared/Container";
import type { StorefrontCategory } from "@/lib/commerce/catalog";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/greatwestgraphics/",
    Icon: Instagram,
  },
  {
    label: "LinkedIn",
    href: "http://www.linkedin.com/profile/view?id=31370827&locale=en_US&trk=tyah",
    Icon: Linkedin,
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/GreatWestGraphicsInc/",
    Icon: Facebook,
  },
];

const FALLBACK_SHOP_LINKS = [
  { label: "T-Shirts", href: "/products?category=t-shirts" },
  { label: "Hoodies & Crewnecks", href: "/products?category=hoodies-and-crewnecks" },
  { label: "Hats", href: "/products?category=hats" },
  { label: "Tote Bags", href: "/products?category=tote-bags" },
  { label: "View All Products", href: "/products" },
];

export function Footer({
  categories = [],
  storeName,
}: {
  categories?: StorefrontCategory[];
  storeName?: string;
}) {
  const isBranded = Boolean(storeName);
  const shopLinks =
    categories.length > 0
      ? [
          ...categories.slice(0, 4).map((c) => ({
            label: c.name,
            href: `/products?category=${encodeURIComponent(c.slug)}`,
          })),
          { label: "View All Products", href: "/products" },
        ]
      : FALLBACK_SHOP_LINKS;

  const serviceLinks = [
    { label: "Embroidery", href: "/quote?method=embroidery" },
    { label: "Screen Printing", href: "/quote?method=screen" },
    { label: "DTF Printing", href: "/quote?method=dtf" },
    { label: "Sublimation Printing", href: "/quote?method=sublimation" },
    { label: "Design Studio", href: "/design" },
  ];

  const importantLinks = [
    { label: "How to Order", href: "/quote" },
    { label: "FAQ", href: "/faq" },
    { label: "Shipping Policy", href: "/shipping" },
    { label: "Privacy Policy", href: "/shipping#privacy" },
    { label: "Sitemap", href: "/products" },
  ];

  const aboutLinks = [
    { label: "Contact Us", href: "/contact" },
    { label: "About Us", href: "/about" },
    { label: "Our Work", href: "/#gallery" },
    { label: "Reviews", href: "/#reviews" },
    { label: "Get a Quote", href: "/quote" },
    ...(isBranded ? [] : [{ label: "Staff login", href: "/admin/login" }]),
  ];

  return (
    <footer className="bg-text-primary text-white/70 pt-sp-7 pb-sp-4">
      <Container className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-sp-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="font-display font-bold text-white text-lg">
            {isBranded ? storeName : "Great West Graphics"}
          </div>
          {!isBranded && (
            <>
              <p className="text-[13.5px] mt-sp-3 max-w-[36ch]">
                Vancouver&apos;s trusted custom print and embroidery partner for
                35 years — real prints, real fast, every time.
              </p>
              <p className="text-[13px] mt-sp-3 max-w-[36ch]">
                #105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6
                <br />
                <a
                  href="mailto:info@greatwestgraphics.com"
                  className="hover:text-white transition-colors"
                >
                  info@greatwestgraphics.com
                </a>{" "}
                ·{" "}
                <a
                  href="tel:+16043213285"
                  className="hover:text-white transition-colors"
                >
                  (604) 321-3285
                </a>
              </p>
            </>
          )}
        </div>

        <FooterCol title="Shop" links={shopLinks} />
        <FooterCol title="Services" links={serviceLinks} />
        <FooterCol title="Important Pages" links={importantLinks} />
        <FooterCol title="About Us" links={aboutLinks} />
      </Container>

      <Container className="flex justify-between flex-wrap gap-2 text-[12.5px] text-white/50 border-t border-white/15 mt-sp-6 pt-sp-3">
        <span>
          {isBranded
            ? `© 2026 ${storeName}. Powered by Great West Graphics.`
            : "© 2026 Great West Graphics. Vancouver, BC. Designed by Codsphere"}
        </span>
        {!isBranded && (
          <div className="flex gap-4">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors inline-flex items-center gap-1"
              >
                <Icon size={14} aria-hidden />
                {label}
              </a>
            ))}
          </div>
        )}
      </Container>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h5 className="text-white font-display text-sm mb-sp-2">{title}</h5>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label} className="text-sm">
            <Link href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
