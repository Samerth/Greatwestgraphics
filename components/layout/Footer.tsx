import Link from "next/link";
import { Facebook, Linkedin, Twitter } from "lucide-react";
import { Container } from "@/components/shared/Container";
import type { StorefrontCategory } from "@/lib/commerce/catalog";

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/GreatWestGraphicsInc/", Icon: Facebook },
  { label: "Twitter", href: "http://twitter.com/#!/GWGraphics", Icon: Twitter },
  {
    label: "LinkedIn",
    href: "http://www.linkedin.com/profile/view?id=31370827&locale=en_US&trk=tyah",
    Icon: Linkedin,
  },
];

const FALLBACK_SHOP_LINKS = [
  { label: "Apparel", href: "/products?category=apparel" },
  { label: "Bags & Totes", href: "/products?category=bags" },
  { label: "Promo Items", href: "/products?category=promo" },
  { label: "Safety Products", href: "/products?category=safety" },
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
      ? categories
          .slice(0, 6)
          .map((c) => ({
            label: c.name,
            href: `/products?category=${encodeURIComponent(c.slug)}`,
          }))
      : FALLBACK_SHOP_LINKS;

  const serviceLinks = [
    { label: "Screen Printing", href: "/quote?method=screen" },
    { label: "Embroidery", href: "/quote?method=embroidery" },
    { label: "Design Your Own", href: "/design" },
    { label: "Bulk Orders", href: "/quote?type=bulk" },
    ...(isBranded ? [] : [{ label: "Branded Team Stores", href: "/start" }]),
  ];

  const supportLinks = [
    { label: "Get a Quote", href: "/quote" },
    { label: "Art Guidelines", href: "/design#art-guidelines" },
    { label: "Shipping", href: "/shipping" },
    { label: "FAQ", href: "/faq" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "My jobs", href: "/portal/jobs" },
    ...(isBranded ? [] : [{ label: "Staff login", href: "/admin/login" }]),
  ];

  return (
    <footer className="bg-text-primary text-white/70 pt-sp-7 pb-sp-4">
      <Container className="grid grid-cols-1 md:grid-cols-4 gap-sp-4">
        <div>
          <div className="flex items-center gap-2.5 font-display font-bold text-white text-xl">
            <span className="w-[38px] h-[38px] rounded-md bg-accent text-white grid place-items-center text-[13px]">
              {isBranded ? storeName!.slice(0, 2).toUpperCase() : "GW"}
            </span>
            {isBranded ? storeName : "Great West Graphics"}
          </div>
          {!isBranded && (
            <p className="text-[13.5px] mt-sp-3 max-w-[36ch]">
              #105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6
              <br />
              <a href="mailto:info@greatwestgraphics.com" className="hover:text-white transition-colors">
                info@greatwestgraphics.com
              </a>{" "}
              ·{" "}
              <a href="tel:+16043213285" className="hover:text-white transition-colors">
                (604) 321-3285
              </a>
            </p>
          )}
          {!isBranded && (
            <div className="flex gap-3 mt-sp-3">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterCol title="Shop" links={shopLinks} />
        <FooterCol title="Services" links={serviceLinks} />
        <FooterCol title="Support" links={supportLinks} />
      </Container>

      <Container className="flex justify-between flex-wrap gap-2 text-[12.5px] text-white/50 border-t border-white/15 mt-sp-6 pt-sp-3">
        <span>
          {isBranded
            ? `© 2026 ${storeName}. Powered by Great West Graphics.`
            : "© 2026 Great West Graphics. Every order proofed before print."}
        </span>
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
