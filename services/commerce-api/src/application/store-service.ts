import { and, eq } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client.js";
import { stores } from "../db/schema.js";

export class ResourceNotFoundError extends Error {
  readonly code = "RESOURCE_NOT_FOUND";
}

export type ResolvedStore = {
  tenantId: string;
  accountId: string;
  storeId: string;
  slug: string;
  name: string;
  status: string;
  logoUrl: string | null;
  accentColor: string | null;
  tagline: string | null;
  pricingAdjustmentPercent: number | null;
  /** Anyone may join by signing in. False for invitation-only team stores. */
  isPublic: boolean;
};

function toResolvedStore(row: typeof stores.$inferSelect): ResolvedStore {
  return {
    tenantId: row.tenantId,
    accountId: row.accountId,
    storeId: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    logoUrl: row.logoUrl,
    accentColor: row.accentColor,
    tagline: row.tagline,
    pricingAdjustmentPercent: row.pricingAdjustmentPercent
      ? Number(row.pricingAdjustmentPercent)
      : null,
    isPublic: row.isPublic,
  };
}

export class StoreService {
  constructor(
    private readonly db: CommerceDatabase,
    /**
     * Domain under which a store's slug doubles as its subdomain, e.g.
     * `stores.example.com` lets `acme.stores.example.com` resolve the store
     * with slug `acme`. Unset means only an exact `custom_domain` resolves.
     */
    private readonly storefrontBaseDomain?: string,
  ) {}

  /**
   * Resolves a store from an inbound Host header. Unlike every other
   * endpoint, this one is intentionally not tenant-scoped by the caller —
   * establishing tenant/account/store identity from the host IS its job,
   * so there's nothing to scope by yet. Custom domain takes priority over
   * subdomain-derived slug.
   */
  async resolveByHost(host: string): Promise<ResolvedStore | null> {
    const normalizedHost = host.split(":")[0]!.toLowerCase();

    const [byDomain] = await this.db
      .select()
      .from(stores)
      .where(eq(stores.customDomain, normalizedHost))
      .limit(1);
    if (byDomain) return toResolvedStore(byDomain);

    const slug = this.subdomainSlug(normalizedHost);
    if (!slug) return null;

    const [bySlug] = await this.db
      .select()
      .from(stores)
      .where(eq(stores.slug, slug))
      .limit(1);
    return bySlug ? toResolvedStore(bySlug) : null;
  }

  /**
   * The first label of `host`, but only when everything after it is exactly
   * the configured base domain.
   *
   * This used to take the first label of any host at all, which made the
   * slug lookup — the one query here that no tenant scopes — reachable from
   * a hostname nobody had registered: point `acme.anything.test` at this API
   * and it answers with Acme's tenant, account and store ids, from whichever
   * tenant happens to own that slug. Requiring the base domain means an
   * unrecognised host resolves to nothing and the caller has to fall back
   * deliberately, rather than being handed a stranger's store.
   */
  private subdomainSlug(host: string): string | null {
    const base = this.storefrontBaseDomain?.trim().toLowerCase().replace(/^\.+/, "");
    if (!base) return null;
    const suffix = `.${base}`;
    if (!host.endsWith(suffix)) return null;
    const label = host.slice(0, -suffix.length);
    return label && !label.includes(".") ? label : null;
  }

  /**
   * Resolves a store from a slug in the URL path, within one tenant.
   *
   * The tenant scope is not optional. `stores.slug` is unique per tenant, not
   * globally, so an unscoped slug lookup would answer `/s/acme` with whichever
   * tenant happened to own that slug — the same hole the host resolver had.
   * A path-based storefront always knows its tenant: it is the one the
   * deployment serves.
   */
  async resolveBySlug(
    tenantId: string,
    slug: string,
  ): Promise<ResolvedStore | null> {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;
    const [row] = await this.db
      .select()
      .from(stores)
      .where(and(eq(stores.tenantId, tenantId), eq(stores.slug, normalized)))
      .limit(1);
    return row ? toResolvedStore(row) : null;
  }

  async getById(tenantId: string, storeId: string): Promise<ResolvedStore> {
    const [row] = await this.db
      .select()
      .from(stores)
      .where(and(eq(stores.tenantId, tenantId), eq(stores.id, storeId)))
      .limit(1);
    if (!row) throw new ResourceNotFoundError("Store not found");
    return toResolvedStore(row);
  }

  /** `percent` is a decimal fraction (e.g. -0.1 for 10% off, 0.05 for 5%
   * up). Pass null to clear the override and fall back to tenant pricing. */
  async setPricingAdjustment(
    tenantId: string,
    storeId: string,
    percent: number | null,
  ): Promise<ResolvedStore> {
    const [updated] = await this.db
      .update(stores)
      .set({
        pricingAdjustmentPercent: percent == null ? null : String(percent),
        updatedAt: new Date(),
      })
      .where(and(eq(stores.tenantId, tenantId), eq(stores.id, storeId)))
      .returning();
    if (!updated) throw new ResourceNotFoundError("Store not found");
    return toResolvedStore(updated);
  }
}
