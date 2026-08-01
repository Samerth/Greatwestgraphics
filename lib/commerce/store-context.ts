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

/**
 * Resolves which store is being served from the inbound Host header,
 * falling back to the fixed dev identity when no host-matched store is
 * found (local dev) or the lookup itself fails. In production a failed
 * resolution throws instead of silently falling back — a real deployment
 * should never hit a host with no matching store row.
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
        const data = (await response.json()) as StoreContext;
        return data;
      }
    }
  } catch {
    // Fall through to the dev-identity fallback below.
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No store could be resolved for this host and no fallback identity is available in production.",
    );
  }

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
});
