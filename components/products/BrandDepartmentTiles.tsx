import Link from "next/link";
import type { BrandOverview } from "@gwg/contracts";
import { CatalogImage } from "@/components/shared/CatalogImage";
import {
  brandCategoryLabel,
  brandDepartments,
  brandListingHref,
  styleCountLabel,
} from "@/lib/commerce/brand-page";

/**
 * The brand page's tile grid: one tile per department the brand sells in,
 * with that department's subcategories listed inside it. Server-rendered —
 * there is nothing to click that a link cannot do.
 *
 * Coastal Reign's equivalent is a flat grid of eight product-type tiles. The
 * subcategory list inside each tile is the extra step: a shopper can see
 * that Gildan has 9 long-sleeve styles and go straight there.
 */
export function BrandDepartmentTiles({ brand }: { brand: BrandOverview }) {
  const departments = brandDepartments(brand.categories);
  if (departments.length === 0) return null;

  return (
    <div
      data-brand="departments"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-sp-3"
    >
      {departments.map((department, index) => {
        const label = brandCategoryLabel(brand, department);
        const href = brandListingHref(brand, department.slug);
        // Up to five subcategories inline; the rest are one click away on
        // the listing's sidebar, which shows all of them.
        const shown = department.children.slice(0, 5);
        const more = department.children.length - shown.length;
        return (
          <article
            key={department.id}
            className="group border border-border rounded-md bg-bg-raised overflow-hidden flex flex-col"
          >
            <Link href={href} className="block">
              <div className="relative aspect-[4/3] bg-white">
                {department.imageUrl ? (
                  <CatalogImage
                    src={department.imageUrl}
                    alt={label}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                    // The first row of tiles sits above the fold and one of
                    // them is the page's largest image, so that row loads
                    // eagerly rather than lazily.
                    priority={index < 4}
                    className="object-contain p-sp-3 transition-transform duration-med group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs text-text-tertiary">
                    No image
                  </div>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-bg/90 backdrop-blur px-2 py-0.5 text-[11px] font-bold text-text-secondary tabular-nums">
                  {styleCountLabel(department.styleCount)}
                </span>
              </div>
            </Link>
            <div className="p-sp-3 flex flex-col gap-2 flex-1">
              <Link
                href={href}
                className="font-display font-bold text-[17px] leading-tight text-text-primary hover:text-accent transition-colors"
              >
                {label}
              </Link>
              {shown.length > 0 && (
                <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
                  {shown.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={brandListingHref(brand, child.slug)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px] font-semibold text-text-secondary hover:border-accent hover:text-accent transition-colors"
                      >
                        {child.name}
                        <span className="text-text-tertiary tabular-nums">
                          {child.styleCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {more > 0 && (
                    <li>
                      <Link
                        href={href}
                        className="inline-flex items-center rounded-full px-2 py-1 text-[12px] font-semibold text-accent hover:underline"
                      >
                        +{more} more
                      </Link>
                    </li>
                  )}
                </ul>
              )}
              <Link
                href={href}
                className="mt-auto pt-1 text-[13px] font-bold text-accent hover:underline"
              >
                Shop {department.name.toLowerCase()} →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
