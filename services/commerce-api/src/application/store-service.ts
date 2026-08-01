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
  };
}

export class StoreService {
  constructor(private readonly db: CommerceDatabase) {}

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

    const subdomain = normalizedHost.split(".")[0];
    if (!subdomain) return null;

    const [bySlug] = await this.db
      .select()
      .from(stores)
      .where(eq(stores.slug, subdomain))
      .limit(1);
    return bySlug ? toResolvedStore(bySlug) : null;
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
