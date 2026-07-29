import { createCommerceClient } from "@/lib/commerce/client";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export type StorefrontCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  styleName: string;
  colorName: string;
  categorySlugs: string[];
  retailMinor: number;
  costMinor: number;
  isDark: boolean;
  available: boolean;
  imageUrl: string | null;
  priceFrom: string;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
};

export async function loadStorefrontCatalog(options?: {
  categorySlug?: string;
  limit?: number;
}): Promise<{
  products: StorefrontCatalogProduct[];
  categories: StorefrontCategory[];
  source: "db" | "empty";
}> {
  try {
    const client = createCommerceClient();
    const [categoriesRaw, productsRaw] = await Promise.all([
      client.listCategories(),
      client.listCatalogProducts({ limit: options?.limit ?? 120 }),
    ]);

    const categories: StorefrontCategory[] = categoriesRaw.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
    }));

    const categoryId =
      options?.categorySlug &&
      categories.find((c) => c.slug === options.categorySlug)?.id;

    const filtered =
      categoryId != null
        ? await client.listCatalogProducts({
            categoryId,
            limit: options?.limit ?? 120,
          })
        : productsRaw;

    if (filtered.length === 0 && productsRaw.length === 0) {
      return { products: [], categories, source: "empty" };
    }

    const products: StorefrontCatalogProduct[] = filtered.map((row) => {
      const retailMinor = Number(row.retailMinor || 0);
      const available = Boolean(row.available);
      return {
        id: String(row.id),
        slug: String(row.slug || row.id),
        name: `${row.brandName || ""} ${row.styleName || row.title || ""}`.trim(),
        brandName: String(row.brandName || ""),
        styleName: String(row.styleName || ""),
        colorName: String(row.colorName || ""),
        categorySlugs: [],
        retailMinor,
        costMinor: Number(row.costMinor || 0),
        isDark: Boolean(row.isDark),
        available,
        imageUrl:
          (row.colorFrontImageUrl as string | null) ||
          (row.styleImageUrl as string | null) ||
          null,
        priceFrom: available
          ? `from ${moneyFromMinor(retailMinor)}`
          : "Unavailable",
      };
    });

    return { products, categories, source: "db" };
  } catch {
    return { products: [], categories: [], source: "empty" };
  }
}

export async function loadStorefrontProduct(productId: string) {
  try {
    const detail = await createCommerceClient().getCatalogProduct(productId);
    return detail;
  } catch {
    return null;
  }
}
