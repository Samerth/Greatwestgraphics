import Link from "next/link";
import { Container } from "@/components/shared/Container";

export function Footer() {
  return (
    <footer className="bg-text-primary text-white/70 pt-sp-7 pb-sp-4">
      <Container className="grid grid-cols-1 md:grid-cols-4 gap-sp-4">
        <div>
          <div className="flex items-center gap-2.5 font-display font-bold text-white text-xl">
            <span className="w-[38px] h-[38px] rounded-md bg-accent text-white grid place-items-center text-[13px]">
              GW
            </span>
            Great West Graphics
          </div>
          <p className="text-[13.5px] mt-sp-3 max-w-[36ch]">
            1234 Industrial Ave, Vancouver, BC V6A 1A1
            <br />
            info@greatwestgraphics.com · (604) 555-0134
          </p>
        </div>

        <FooterCol
          title="Shop"
          links={[
            { label: "Apparel", href: "/products" },
            { label: "Bags & Totes", href: "/products" },
            { label: "Promo Items", href: "/products" },
            { label: "Safety Products", href: "/products" },
          ]}
        />
        <FooterCol
          title="Services"
          links={[
            { label: "Screen Printing", href: "#" },
            { label: "Embroidery", href: "#" },
            { label: "Design Your Own", href: "/design" },
            { label: "Bulk Orders", href: "#" },
          ]}
        />
        <FooterCol
          title="Support"
          links={[
            { label: "Get a Quote", href: "/#quote" },
            { label: "Art Guidelines", href: "#" },
            { label: "Shipping", href: "#" },
            { label: "Contact", href: "#" },
          ]}
        />
      </Container>

      <Container className="flex justify-between flex-wrap gap-2 text-[12.5px] text-white/50 border-t border-white/15 mt-sp-6 pt-sp-3">
        <span>© 2026 Great West Graphics. Every order proofed before print.</span>
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
