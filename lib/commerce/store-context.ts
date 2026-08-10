import { cache } from "react";
import { headers } from "next/headers";
import { loadCommerceWebEnvironment } from "./config";

export type StoreContext = {
  tenantId: string;
  accountId: string;
  storeId: string;
  slug: string;
  name: string;
  status: string;
  logoUrl: string | null;
  accentColor: string | null;
  tagline: string | null;
};

const DEV_HOST_PREFIXES = ["localhost", "127.0.0.1", "[::1]"];

/** Public marketing-shell identity when no store can be resolved (e.g. Vercel
 * preview hosts without a `custom_domain` row). Catalog calls still require
 * `COMMERCE_API_BASE_URL` + real tenant headers; loaders already degrade. */
export const PUBLIC_STOREFRONT_FALLBACK: StoreContext = {
  tenantId: "",
  accountId: "",
  storeId: "",
  slug: "great-west-graphics",
  name: "Great West Graphics",
  status: "active",
  logoUrl: null,
  accentColor: null,
  tagline: null,
};

function productionDefaultStore(): StoreContext | null {
  const tenantId = process.env.COMMERCE_DEFAULT_TENANT_ID?.trim();
  const accountId = process.env.COMMERCE_DEFAULT_ACCOUNT_ID?.trim();
  const storeId = process.env.COMMERCE_DEFAULT_STORE_ID?.trim();
  if (!tenantId || !accountId || !storeId) return null;
  return {
    tenantId,
    accountId,
    storeId,
    slug: process.env.COMMERCE_DEFAULT_STORE_SLUG?.trim() || "great-west-graphics",
    name: process.env.COMMERCE_DEFAULT_STORE_NAME?.trim() || "Great West Graphics",
    status: "active",
    logoUrl: null,
    accentColor: null,
    tagline: null,
  };
}

/**
 * Resolves which store is being served from the inbound Host header.
 *
 * Order: host lookup → production `COMMERCE_DEFAULT_*` → local `COMMERCE_DEV_*`
 * → public marketing shell (never throw; a hard throw here takes down every
 * shop page via the root layout / global-error boundary).
 */
export const resolveStoreContext = cache(async (): Promise<StoreContext> => {
  const baseUrl = process.env.COMMERCE_API_BASE_URL;
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (host && baseUrl && !DEV_HOST_PREFIXES.some((p) => host.startsWith(p))) {
      const response = await fetch(
        `${baseUrl}/v1/stores/by-host?host=${encodeURIComponent(host)}`,
        { cache: "no-store", signal: AbortSignal.timeout(10_000) },
      );
      if (response.ok) {
        return (await response.json()) as StoreContext;
      }
    }
  } catch {
    // Fall through to configured / public fallbacks below.
  }

  const productionDefault = productionDefaultStore();
  if (productionDefault) return productionDefault;

  if (process.env.NODE_ENV !== "production") {
    const devEnv = loadCommerceWebEnvironment();
    return {
      tenantId: devEnv.COMMERCE_DEV_TENANT_ID,
      accountId: devEnv.COMMERCE_DEV_ACCOUNT_ID,
      storeId: devEnv.COMMERCE_DEV_STORE_ID,
      slug: "development",
      name: "Development Storefront",
      status: "active",
      logoUrl: null,
      accentColor: null,
      tagline: null,
    };
  }

  // eslint-disable-next-line no-console
  console.error(
    "[resolveStoreContext] No store for this host. Set COMMERCE_API_BASE_URL + stores.custom_domain, or COMMERCE_DEFAULT_* ids. Serving public marketing shell.",
  );
  return PUBLIC_STOREFRONT_FALLBACK;
});
