import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ProductDetail } from "@/components/pdp/ProductDetail";
import { CrossSellGrid } from "@/components/shared/CrossSellGrid";
import { ButtonLink } from "@/components/shared/Button";
import { CATALOG } from "@/lib/data/products";
import {
  loadStorefrontCatalog,
  loadStorefrontProduct,
} from "@/lib/commerce/catalog";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

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
    const imageUrl =
      (product.colorFrontImageUrl as string | null) ||
      (style.styleImageUrl as string | null);
    const available =
      Boolean(product.active) && Number(product.qty || 0) > 0;
    const title = `${style.brandName || ""} ${style.styleName || ""}`.trim();

    return (
      <>
        <section className="py-sp-8">
          <Container>
            <div className="text-[13px] text-text-tertiary mb-sp-3">
              Home / Shop /{" "}
              <b className="text-text-primary">
                {title} · {String(product.colorName || "")}
              </b>
            </div>
            <div className="grid lg:grid-cols-2 gap-sp-5">
              <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-raised">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-fill-subtle-15" />
                )}
              </div>
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
                <p className="text-lg font-bold mt-sp-3 mb-0">
                  {available
                    ? `from ${moneyFromMinor(
                        Number(variants[0]?.retailMinor || 0),
                      )}`
                    : "Unavailable"}
                </p>
                <div className="mt-sp-4 flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const inStock =
                      Number(v.qty || 0) > 0 && v.active !== false;
                    return (
                      <span
                        key={String(v.id)}
                        className={`border rounded-sm px-3 py-1.5 text-sm font-semibold ${
                          inStock
                            ? "border-border"
                            : "border-amber-300 text-amber-800 bg-amber-50"
                        }`}
                      >
                        {String(v.sizeName || "")}
                        {!inStock ? " · Unavailable" : ""}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-sp-5 flex gap-3">
                  <ButtonLink href="/quote" variant="primary">
                    Get a quote
                  </ButtonLink>
                  <ButtonLink href="/products" variant="secondary">
                    Back to catalogue
                  </ButtonLink>
                </div>
              </div>
            </div>
          </Container>
        </section>
      </>
    );
  }

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

        <section className="py-sp-8">
          <Container>
            <CrossSellGrid title="Complete your project" />
          </Container>
        </section>
      </>
    );
  }

  // Fallback: resolve DB product by slug when no id query
  const catalog = await loadStorefrontCatalog({ limit: 200 });
  const match = catalog.products.find((p) => p.slug === slug);
  if (match) {
    return (
      <section className="py-sp-8">
        <Container>
          <p className="text-text-secondary">
            Opening catalog product…
          </p>
          <Link
            href={`/product/${encodeURIComponent(match.slug)}?id=${match.id}`}
            className="text-accent font-bold"
          >
            Continue to {match.name}
          </Link>
        </Container>
      </section>
    );
  }

  notFound();
}
