import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { CatalogImage } from "@/components/shared/CatalogImage";
import { CatalogUnavailable } from "@/components/shared/CatalogUnavailable";
import { loadStorefrontBrandIndex } from "@/lib/commerce/catalog";
import { brandPageHref, styleCountLabel } from "@/lib/commerce/brand-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brands",
  description:
    "Every brand we decorate in Vancouver - Gildan, ATC, Bella+Canvas, Carhartt, Nike, The North Face and more - screen printed or embroidered with a free digital proof.",
  alternates: { canonical: "/brands" },
};

/**
 * The brands index: where the header's "View All Brands" and the brand
 * page breadcrumb go. Grouped by first letter so a long list stays
 * scannable, with the vendor's logo where one was supplied and the style
 * count so a shopper can tell a deep range from a single item.
 */
export default async function BrandsPage() {
  const { brands, source } = await loadStorefrontBrandIndex();

  // A-Z groups. A brand starting with a digit or symbol goes under "#".
  const groups = new Map<string, typeof brands>();
  for (const brand of brands) {
    const first = brand.name.trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    const list = groups.get(key) ?? [];
    list.push(brand);
    groups.set(key, list);
  }
  const letters = [...groups.keys()].sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b),
  );

  return (
    <>
      <section className="pt-sp-6 pb-sp-5 border-b border-border bg-bg-raised">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>{" "}
            / <b className="text-text-primary">Brands</b>
          </div>
          <h1 className="font-display font-bold text-display leading-display m-0">
            Shop by Brand
          </h1>
          <p className="m-0 mt-2 text-text-secondary max-w-[62ch]">
            {brands.length > 0
              ? `${brands.length} brands in stock, every one decorated in-house in Vancouver.`
              : "Every brand we decorate in-house in Vancouver."}
          </p>
        </Container>
      </section>

      <section className="py-sp-6 lg:py-sp-7">
        <Container>
          {source === "error" ? (
            <CatalogUnavailable retryHref="/brands" />
          ) : (
            <>
              <nav
                aria-label="Jump to letter"
                className="flex flex-wrap gap-1.5 mb-sp-5"
              >
                {letters.map((letter) => (
                  <a
                    key={letter}
                    href={`#brands-${letter === "#" ? "other" : letter}`}
                    className="h-8 min-w-8 px-2 rounded-sm border border-border grid place-items-center text-[13px] font-bold text-text-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    {letter}
                  </a>
                ))}
              </nav>

              <div className="space-y-sp-6">
                {letters.map((letter) => (
                  <div
                    key={letter}
                    id={`brands-${letter === "#" ? "other" : letter}`}
                    className="scroll-mt-[120px]"
                  >
                    <h2 className="font-display font-bold text-[22px] m-0 mb-sp-3 pb-2 border-b border-border">
                      {letter}
                    </h2>
                    <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-sp-3">
                      {groups.get(letter)!.map((brand) => (
                        <li key={brand.slug}>
                          <Link
                            href={brandPageHref(brand)}
                            className="group flex items-center gap-3 rounded-md border border-border bg-bg-raised p-3 hover:border-accent transition-colors h-full"
                          >
                            <span className="relative h-10 w-16 shrink-0 bg-white rounded-sm border border-border grid place-items-center overflow-hidden">
                              {brand.logoUrl ? (
                                <CatalogImage
                                  src={brand.logoUrl}
                                  alt=""
                                  fill
                                  sizes="64px"
                                  className="object-contain p-1"
                                />
                              ) : (
                                <span className="font-display font-bold text-[13px] text-text-tertiary">
                                  {brand.name.charAt(0)}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-[14px] leading-snug text-text-primary group-hover:text-accent transition-colors">
                                {brand.name}
                              </span>
                              <span className="block text-[12px] text-text-tertiary tabular-nums">
                                {styleCountLabel(brand.styleCount)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </Container>
      </section>
    </>
  );
}
