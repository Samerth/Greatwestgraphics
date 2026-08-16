import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ProductDetail } from "@/components/pdp/ProductDetail";
import { DbProductActions } from "@/components/pdp/DbProductActions";
import { PreviewDesignButton } from "@/components/pdp/PreviewDesignButton";
import { SizeChartPDFViewer } from "@/components/pdp/SizeChartPDFViewer";
import {
  PdpEnrichmentSections,
  PdpFeatureBullets,
  PdpOutOfStockBanner,
  PdpTrustChecks,
} from "@/components/pdp/PdpEnrichment";
import { PdpImageGallery } from "@/components/pdp/PdpImageGallery";
import { CrossSellGrid } from "@/components/shared/CrossSellGrid";
import { ButtonLink } from "@/components/shared/Button";
import { CATALOG } from "@/lib/data/products";
import {
  loadStorefrontCatalog,
  loadStorefrontProduct,
  toCrossSellItems,
} from "@/lib/commerce/catalog";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import type { GarmentPriceCurve } from "@gwg/pricing";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type ProductPageParams = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: ProductPageParams): Promise<Metadata> {
  const { slug } = await params;
  const { id } = await searchParams;

  if (id) {
    const detail = await loadStorefrontProduct(id);
    if (!detail) return {};
    const product = detail.product as Record<string, unknown>;
    const style = detail.style as Record<string, unknown>;
    const title = `${style.brandName || ""} ${style.styleName || ""}`.trim();
    const colorName = String(product.colorName || "");
    const fullTitle = colorName ? `${title} · ${colorName}` : title;
    const description = `Custom decorated ${title}, ${colorName || "multiple colours"}. Screen printed or embroidered in Vancouver, proofed before production.`;
    const imageUrl =
      (product.colorFrontImageUrl as string | null) ||
      (style.styleImageUrl as string | null);
    const canonical = `/product/${encodeURIComponent(slug)}?id=${id}`;

    return {
      title: fullTitle,
      description,
      alternates: { canonical },
      openGraph: {
        type: "website",
        title: fullTitle,
        description,
        url: canonical,
        images: imageUrl ? [{ url: imageUrl }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: fullTitle,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
    };
  }

  const staticProduct = CATALOG.find((item) => item.slug === slug);
  if (staticProduct) {
    const description = `${staticProduct.name} — ${staticProduct.sub || "custom decorated"}. ${staticProduct.priceFrom}, screen printed or embroidered in Vancouver.`;
    return {
      title: staticProduct.name,
      description,
      alternates: { canonical: `/product/${slug}` },
      openGraph: {
        type: "website",
        title: staticProduct.name,
        description,
        url: `/product/${slug}`,
      },
    };
  }

  return {};
}

function ProductJsonLd({
  name,
  description,
  imageUrl,
  url,
  priceMinor,
  available,
}: {
  name: string;
  description: string;
  imageUrl: string | null;
  url: string;
  priceMinor: number;
  available: boolean;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: imageUrl ? [imageUrl] : undefined,
    url,
    brand: { "@type": "Brand", name: "Great West Graphics" },
    offers: {
      "@type": "Offer",
      priceCurrency: "CAD",
      price: (priceMinor / 100).toFixed(2),
      availability: available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Machine-readable twin of the "Home / Shop / …" trail rendered above the
 * product, so search results can show the same path. */
function BreadcrumbJsonLd({ name, url }: { name: string; url: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/products` },
      { "@type": "ListItem", position: 3, name, item: url },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const { id } = await searchParams;

  if (id) {
    const detail = await loadStorefrontProduct(id);
    if (!detail) notFound();
    const product = detail.product as Record<string, unknown>;
    const style = detail.style as Record<string, unknown>;
    const variants = (detail.variants as Record<string, unknown>[]) || [];
    const colorways = (detail.colorways as Record<string, unknown>[]) || [];
    const imageUrl =
      (product.colorFrontImageUrl as string | null) ||
      (style.styleImageUrl as string | null);
    const sideImageUrl = (product.colorSideImageUrl as string | null) || null;
    const backImageUrl = (product.colorBackImageUrl as string | null) || null;
    const available =
      Boolean(product.active) && Number(product.qty || 0) > 0;
    const title = `${style.brandName || ""} ${style.styleName || ""}`.trim();
    const relatedCatalog = await loadStorefrontCatalog({ limit: 12 });
    const relatedItems = toCrossSellItems(
      relatedCatalog.products.filter((p) => p.id !== String(product.id)),
    );
    const gallery = [
      { label: "Front", url: imageUrl },
      { label: "Side", url: sideImageUrl },
      { label: "Back", url: backImageUrl },
    ].filter((item): item is { label: string; url: string } => Boolean(item.url));

    return (
      <>
        <ProductJsonLd
          name={`${title} · ${String(product.colorName || "")}`.trim()}
          description={`Custom decorated ${title}, ${String(product.colorName || "") || "multiple colours"}. Screen printed or embroidered in Vancouver.`}
          imageUrl={imageUrl}
          url={`${SITE_URL}/product/${encodeURIComponent(slug)}?id=${id}`}
          priceMinor={Number(variants[0]?.retailMinor || 0)}
          available={available}
        />
        <BreadcrumbJsonLd
          name={`${title} · ${String(product.colorName || "")}`.trim()}
          url={`${SITE_URL}/product/${encodeURIComponent(slug)}?id=${id}`}
        />
        <section className="py-sp-8">
          <Container>
            <div className="text-[13px] text-text-tertiary mb-sp-3">
              Home / Shop /{" "}
              <b className="text-text-primary">
                {title} · {String(product.colorName || "")}
              </b>
            </div>
            <div className="grid lg:grid-cols-2 gap-sp-5">
              <PdpImageGallery images={gallery} alt={title} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
                  {String(style.brandName || "")}
                </p>
                <h1 className="font-display font-bold text-display-sm m-0 mt-1">
                  {String(style.styleName || title)}
                </h1>
                <p className="text-text-secondary mt-2 mb-0">
                  {String(product.colorName || "")}
                  {product.isDark ? " · Dark garment" : ""}
                </p>

                {colorways.length > 1 && (
                  <div className="mt-sp-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">
                      Colour: <span className="text-text-primary normal-case">{String(product.colorName || "")}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colorways.map((c) => {
                        const cId = String(c.id);
                        const swatchUrl =
                          (c.swatchImageUrl as string | null) ||
                          (c.frontImageUrl as string | null);
                        const isActive = cId === String(product.id);
                        return (
                          <Link
                            key={cId}
                            href={`/product/${encodeURIComponent(String(c.slug))}?id=${cId}`}
                            title={String(c.colorName || "")}
                            className={`relative w-11 h-11 rounded-md overflow-hidden border-2 transition-colors ${
                              isActive
                                ? "border-accent"
                                : "border-border hover:border-text-tertiary"
                            }`}
                          >
                            {swatchUrl ? (
                              <Image
                                src={swatchUrl}
                                alt={String(c.colorName || "")}
                                fill
                                className="object-cover"
                                sizes="44px"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-fill-subtle-15" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-lg font-bold mt-sp-3 mb-0">
                  {available
                    ? `from ${moneyFromMinor(
                        Number(variants[0]?.retailMinor || 0),
                      )}`
                    : "Unavailable"}
                </p>

                <PdpTrustChecks />
                <PdpFeatureBullets
                  description={(style.description as string | null) || null}
                />

                {!available && (
                  <PdpOutOfStockBanner
                    colorName={String(product.colorName || "")}
                  />
                )}

                {available && (
                  <PreviewDesignButton
                    productId={String(product.id)}
                    className="mt-sp-4 flex items-center justify-center gap-2 w-full rounded-md bg-accent text-white font-bold text-sm py-3 px-4 hover:bg-accent-hover transition-colors"
                  />
                )}

                <div className="mt-sp-4 pt-sp-4 border-t border-border">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-sp-2">
                    Or order it blank
                  </p>
                  <DbProductActions
                    productId={String(product.id)}
                    styleId={String(style.id)}
                    name={title}
                    color={String(product.colorName || "")}
                    image={imageUrl}
                    variants={variants.map((v) => ({
                      id: String(v.id),
                      sizeName: String(v.sizeName || ""),
                      retailMinor: Number(v.retailMinor || 0),
                      costMinor: Number(v.customerPriceMinor || 0),
                      mapPriceMinor:
                        v.mapPriceMinor == null
                          ? null
                          : Number(v.mapPriceMinor),
                      priceCurve:
                        (v.priceCurve as GarmentPriceCurve | null) ?? null,
                      inStock: Number(v.qty || 0) > 0 && v.active !== false,
                    }))}
                  />
                </div>

                {typeof style.sizeChartPdfUrl === "string" &&
                  style.sizeChartPdfUrl.length > 0 && (
                  <SizeChartPDFViewer
                    pdfUrl={style.sizeChartPdfUrl}
                    label={`Official Size Chart — ${String(style.brandName || "")}`}
                    productName={title}
                  />
                )}

                <div className="mt-sp-4 flex gap-3">
                  <ButtonLink href="/quote" variant="secondary">
                    Get a formal quote instead
                  </ButtonLink>
                  <ButtonLink href="/products" variant="secondary">
                    Back to catalogue
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <PdpEnrichmentSections
          brandName={String(style.brandName || "")}
          styleName={String(style.styleName || title)}
          styleTitle={(style.title as string | null) || null}
          partNumber={(style.partNumber as string | null) || null}
          sizeRange={
            variants.length > 1
              ? `${String(variants[0]?.sizeName || "")} – ${String(
                  variants[variants.length - 1]?.sizeName || "",
                )}`
              : variants.length === 1
                ? String(variants[0]?.sizeName || "")
                : undefined
          }
          colourCount={colorways.length}
          description={(style.description as string | null) || null}
        />

        <section className="py-sp-8">
          <Container>
            <CrossSellGrid
              title="Complete Your Project"
              items={relatedItems}
            />
          </Container>
        </section>
      </>
    );
  }

  const catalog = await loadStorefrontCatalog({ limit: 12 });
  const crossSellItems = toCrossSellItems(
    catalog.products.filter((p) => p.slug !== slug),
  );

  const staticProduct = CATALOG.find((item) => item.slug === slug);
  if (staticProduct) {
    return (
      <>
        <section className="py-sp-8">
          <Container>
            <div className="text-[13px] text-text-tertiary mb-sp-3">
              Home / Shop / {staticProduct.category} /{" "}
              <b className="text-text-primary">{staticProduct.name}</b>
            </div>
            <ProductDetail slug={slug} />
          </Container>
        </section>

        <PdpEnrichmentSections
          styleName={staticProduct.name}
          description={staticProduct.sub ?? null}
        />

        <section className="py-sp-8">
          <Container>
            <CrossSellGrid
              title="Complete Your Project"
              items={crossSellItems.length > 0 ? crossSellItems : undefined}
            />
          </Container>
        </section>
      </>
    );
  }

  // A bare /product/<slug> with no ?id — an old bookmark, a shared link with
  // the query string stripped, or a crawler. Resolve the slug against the
  // catalog and send the visitor to the canonical URL. This used to render an
  // "Opening catalog product…" page with a manual "Continue" link, which is a
  // dead end for anyone who doesn't notice the link and for every crawler.
  // The lookup is a targeted search rather than a scan of the first N
  // products, so it resolves slugs from anywhere in a five-figure catalog.
  const bySlug = await loadStorefrontCatalog({ search: slug, limit: 60 });
  const match = bySlug.products.find((p) => p.slug === slug);
  if (match) {
    redirect(`/product/${encodeURIComponent(match.slug)}?id=${match.id}`);
  }

  notFound();
}
