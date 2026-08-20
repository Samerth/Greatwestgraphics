import { cache } from "react";
import { headers } from "next/headers";
import { loadCommerceWebEnvironment } from "./config";
import { STORE_SLUG_HEADER } from "./store-cookie";

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
  /**
   * The operator's own shop, which anyone may browse and join by signing in.
   * False for a corporate team store, whose members arrive by invitation. Used
   * to decide what to tell a visitor who does not belong here — the access
   * rule itself is enforced by the API, not by this flag.
   */
  isPublic: boolean;
};

/** API store payloads predate `isPublic`; absent means "not a public shop". */
function withVisibility(payload: unknown): StoreContext {
  const store = payload as StoreContext;
  return { ...store, isPublic: Boolean(store.isPublic) };
}

const DEV_HOST_PREFIXES = ["localhost", "127.0.0.1", "[::1]"];

/** Public marketing-shell identity when no store can be resolved (hosts
 * without a `custom_domain` row). Catalog calls still require
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
  isPublic: true,
};

/** The one store this deployment serves, when its identity is pinned in the
 * environment rather than discovered per request. A deployment that wants
 * per-host branding out of the `stores` row leaves these unset. */
function pinnedStore(): StoreContext | null {
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
    isPublic: true,
  };
}

/**
 * The branded store the visitor selected via `/s/<slug>`, if it exists.
 *
 * A store awaiting approval is returned as itself rather than skipped: the
 * shop layout already refuses to serve a store that is not active and says so
 * by name, which is a better answer to an early-shared link than silently
 * showing the main site instead.
 */
async function selectedStore(tenantId?: string): Promise<StoreContext | null> {
  const baseUrl = process.env.COMMERCE_API_BASE_URL;
  if (!tenantId || !baseUrl) return null;
  try {
    const requestHeaders = await headers();
    const slug = requestHeaders.get(STORE_SLUG_HEADER);
    if (!slug) return null;

    const response = await fetch(
      `${baseUrl}/v1/stores/by-slug?tenantId=${encodeURIComponent(tenantId)}&slug=${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return null;
    return withVisibility(await response.json());
  } catch {
    return null;
  }
}

/**
 * Resolves which store is being served.
 *
 * Order: pinned `COMMERCE_DEFAULT_*` → host lookup → local `COMMERCE_DEV_*` →
 * public marketing shell (never throw; a hard throw here takes down every shop
 * page via the root layout / global-error boundary).
 *
 * The pin comes first because a deployment that sets it serves exactly one
 * store: its identity is a deployment decision, not something to rediscover on
 * every render. Asking the API to resolve the Host header first meant the
 * single-store deployments spent a round trip per render on a question they had
 * already answered, and the 404 that came back read as a fault rather than as
 * "this environment does not resolve stores by host". Host resolution is still
 * the mechanism for a deployment that serves several stores, which is precisely
 * the one that leaves the pin unset.
 */
export const resolveStoreContext = cache(async (): Promise<StoreContext> => {
  const pinned = pinnedStore();

  // A branded store chosen through /s/<slug> outranks the pin: the pin says
  // which store this deployment serves by default, not which one this visitor
  // asked for. Scoped to the pinned tenant because a slug is only unique
  // inside one.
  const selected = await selectedStore(pinned?.tenantId);
  if (selected) return selected;

  if (pinned) return pinned;

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
        return withVisibility(await response.json());
      }
    }
  } catch {
    // Fall through to the development / public fallbacks below.
  }

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
      isPublic: true,
    };
  }

   
  console.error(
    "[resolveStoreContext] No store for this deployment. Set COMMERCE_DEFAULT_TENANT_ID/_ACCOUNT_ID/_STORE_ID, or register this host as a stores.custom_domain. Serving public marketing shell with an empty catalogue.",
  );
  return PUBLIC_STOREFRONT_FALLBACK;
});
