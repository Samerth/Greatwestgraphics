import { TickBar } from "@/components/layout/TickBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { loadStorefrontCategories } from "@/lib/commerce/catalog";
import { getCustomerSession } from "@/lib/auth/session";
import {
  PUBLIC_STOREFRONT_FALLBACK,
  resolveStoreContext,
} from "@/lib/commerce/store-context";
import { brandColorVars } from "@/lib/utils/color";
import { OrganizationJsonLd } from "@/components/shared/OrganizationJsonLd";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Store resolution must never take down the whole shop shell — layout
  // errors bubble past (shop)/error.tsx into global-error.
  const [categories, customerSession, store] = await Promise.all([
    loadStorefrontCategories(),
    getCustomerSession().catch(() => null),
    resolveStoreContext().catch(() => PUBLIC_STOREFRONT_FALLBACK),
  ]);

  const isBranded = Boolean(store.accentColor || store.logoUrl);

  if (store.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display font-bold text-2xl mb-2">
            {store.name} isn&apos;t live yet
          </h1>
          <p className="text-text-secondary max-w-[48ch]">
            {store.status === "pending_review"
              ? "This store is still being reviewed. Check back shortly."
              : "This store isn't currently available."}
          </p>
        </div>
      </div>
    );
  }

  const brandVars = brandColorVars(store.accentColor);

  return (
    <div style={brandVars as React.CSSProperties | undefined}>
      {!isBranded && <OrganizationJsonLd />}
      <TickBar />
      <Header
        categories={categories}
        customerName={customerSession?.name ?? null}
        storeName={isBranded ? store.name : undefined}
        storeLogoUrl={store.logoUrl}
      />

      <main>{children}</main>

      <Footer categories={categories} storeName={isBranded ? store.name : undefined} />

      {!isBranded && <ThemeToggle />}
    </div>
  );
}
