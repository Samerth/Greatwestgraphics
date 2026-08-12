import { and, asc, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type {
  Actor,
  PreviewQuoteV2,
  PreviewQuoteV2Response,
  PricingConfigSelector,
  PricingConfigV2,
  PricingConfigV2DraftResponse,
  PricingConfigV2VersionSummary,
  PublishedPricingConfigV2Response,
  PublishPricingConfigV2,
  QuotePreviewResult,
  RestorePricingConfigV2Draft,
  UpsertPricingConfigV2Draft,
} from "@gwg/contracts";
import { PricingConfigV2Schema } from "@gwg/contracts";
import { calculateQuoteV2, PRICING_MASTER_V2 } from "@gwg/pricing";
import type { CommerceDatabase } from "../db/client.js";
import { idempotencyKeys, pricingConfigs } from "../db/schema.js";
import {
  DataIntegrityError,
  IdempotencyConflictError,
  ResourceNotFoundError,
} from "./job-request-service.js";

const SCHEMA_VERSION = 2;

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type Row = typeof pricingConfigs.$inferSelect;

function parseConfig(row: Row): PricingConfigV2 {
  return PricingConfigV2Schema.parse(row.config);
}

/**
 * Pricing config v2 — decoration methods, rate tables and every fee are stored
 * as data so staff can change pricing without a deploy. Drafts are edited
 * freely; publishing snapshots the draft as a new immutable version, which is
 * what quotes reference so a later price change never rewrites an old quote.
 */
export class PricingConfigV2Service {
  constructor(private readonly db: CommerceDatabase) {}

  private base() {
    return eq(pricingConfigs.schemaVersion, SCHEMA_VERSION);
  }

  private async findByStatus(tenantId: string, status: "draft" | "published") {
    const [row] = await this.db
      .select()
      .from(pricingConfigs)
      .where(
        and(
          eq(pricingConfigs.tenantId, tenantId),
          eq(pricingConfigs.status, status),
          this.base(),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getPublished(
    tenantId: string,
  ): Promise<PublishedPricingConfigV2Response> {
    const row = await this.findByStatus(tenantId, "published");
    if (!row) {
      throw new ResourceNotFoundError(
        "No published v2 pricing config exists for this tenant",
      );
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
      version: row.version,
      status: "published",
      publishedAt: row.publishedAt?.toISOString() ?? null,
      config: { ...parseConfig(row), status: "published" },
    };
  }

  /**
   * Returns the editable draft, seeding one from the published config (or the
   * imported estimator workbook on a fresh tenant) the first time it's opened.
   */
  async getDraft(tenantId: string): Promise<PricingConfigV2DraftResponse> {
    const existing = await this.findByStatus(tenantId, "draft");
    const published = await this.findByStatus(tenantId, "published");

    if (existing) {
      return {
        id: existing.id,
        tenantId: existing.tenantId,
        version: existing.version,
        status: "draft",
        config: parseConfig(existing),
        publishedVersion: published?.version ?? null,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    const baseConfig = published
      ? parseConfig(published)
      : PricingConfigV2Schema.parse(PRICING_MASTER_V2);
    const nextVersion = (published?.version ?? 0) + 1;
    const draftConfig: PricingConfigV2 = {
      ...structuredClone(baseConfig),
      version: nextVersion,
      status: "draft",
    };

    const [created] = await this.db
      .insert(pricingConfigs)
      .values({
        tenantId,
        version: nextVersion,
        schemaVersion: SCHEMA_VERSION,
        status: "draft",
        config: draftConfig,
        createdBy: { type: "system", displayName: "pricing-v2-bootstrap" },
        source: { system: "commerce_api" },
      })
      .returning();

    if (!created) throw new DataIntegrityError("Failed to create pricing draft");

    return {
      id: created.id,
      tenantId: created.tenantId,
      version: created.version,
      status: "draft",
      config: draftConfig,
      publishedVersion: published?.version ?? null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async upsertDraft(
    command: UpsertPricingConfigV2Draft,
    actor: Actor,
  ): Promise<PricingConfigV2DraftResponse> {
    const tenantId = command.context.tenantId;
    const config = PricingConfigV2Schema.parse({
      ...command.config,
      status: "draft",
    });

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(pricingConfigs)
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "draft"),
            eq(pricingConfigs.schemaVersion, SCHEMA_VERSION),
          ),
        )
        .limit(1);

      const [published] = await tx
        .select()
        .from(pricingConfigs)
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "published"),
            eq(pricingConfigs.schemaVersion, SCHEMA_VERSION),
          ),
        )
        .limit(1);

      const version = existing?.version ?? (published?.version ?? 0) + 1;
      const nextConfig: PricingConfigV2 = { ...config, version, status: "draft" };

      const row = existing
        ? (
            await tx
              .update(pricingConfigs)
              .set({
                config: nextConfig,
                updatedAt: new Date(),
                createdBy: actor,
                source: { system: "commerce_api" },
              })
              .where(eq(pricingConfigs.id, existing.id))
              .returning()
          )[0]
        : (
            await tx
              .insert(pricingConfigs)
              .values({
                tenantId,
                version,
                schemaVersion: SCHEMA_VERSION,
                status: "draft",
                config: nextConfig,
                createdBy: actor,
                source: { system: "commerce_api" },
              })
              .returning()
          )[0];

      if (!row) throw new DataIntegrityError("Failed to save pricing draft");

      return {
        id: row.id,
        tenantId: row.tenantId,
        version: row.version,
        status: "draft" as const,
        config: nextConfig,
        publishedVersion: published?.version ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async publish(
    command: PublishPricingConfigV2,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<PublishedPricingConfigV2Response> {
    const { tenantId } = command.context;
    const operation = "pricing_config_v2.publish";
    const hash = requestHash(command);

    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${tenantId}:${operation}:${idempotencyKey}`}))`,
      );

      const [prior] = await tx
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.tenantId, tenantId),
            eq(idempotencyKeys.accountId, command.context.accountId),
            eq(idempotencyKeys.operation, operation),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .limit(1);

      if (prior) {
        if (prior.requestHash !== hash) {
          throw new IdempotencyConflictError(
            "The idempotency key was already used with a different request",
          );
        }
        const [existing] = await tx
          .select()
          .from(pricingConfigs)
          .where(eq(pricingConfigs.id, prior.resourceId))
          .limit(1);
        if (!existing) {
          throw new DataIntegrityError(
            "Idempotent publish references a missing pricing config",
          );
        }
        return {
          id: existing.id,
          tenantId: existing.tenantId,
          version: existing.version,
          status: "published" as const,
          publishedAt: existing.publishedAt?.toISOString() ?? null,
          config: parseConfig(existing),
        };
      }

      const [draft] = await tx
        .select()
        .from(pricingConfigs)
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "draft"),
            eq(pricingConfigs.schemaVersion, SCHEMA_VERSION),
          ),
        )
        .limit(1);

      if (!draft) {
        throw new ResourceNotFoundError("No draft pricing config to publish");
      }

      // Older published versions are kept, not overwritten, so a quote can
      // always be re-rendered with the prices that produced it.
      await tx
        .update(pricingConfigs)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "published"),
            eq(pricingConfigs.schemaVersion, SCHEMA_VERSION),
          ),
        );

      const publishedConfig: PricingConfigV2 = {
        ...parseConfig(draft),
        version: draft.version,
        status: "published",
        notes: command.notes || parseConfig(draft).notes,
      };
      const now = new Date();

      const [published] = await tx
        .update(pricingConfigs)
        .set({
          status: "published",
          config: publishedConfig,
          publishedAt: now,
          updatedAt: now,
          createdBy: actor,
          source: command.source,
        })
        .where(eq(pricingConfigs.id, draft.id))
        .returning();

      if (!published) {
        throw new DataIntegrityError("Failed to publish pricing config");
      }

      await tx.insert(idempotencyKeys).values({
        tenantId,
        accountId: command.context.accountId,
        operation,
        key: idempotencyKey,
        requestHash: hash,
        resourceId: published.id,
      });

      return {
        id: published.id,
        tenantId: published.tenantId,
        version: published.version,
        status: "published" as const,
        publishedAt: now.toISOString(),
        config: publishedConfig,
      };
    });
  }

  async listVersions(
    tenantId: string,
  ): Promise<PricingConfigV2VersionSummary[]> {
    const rows = await this.db
      .select()
      .from(pricingConfigs)
      .where(and(eq(pricingConfigs.tenantId, tenantId), this.base()))
      .orderBy(desc(pricingConfigs.version), asc(pricingConfigs.createdAt));

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      status: row.status as PricingConfigV2VersionSummary["status"],
      notes: (row.config as PricingConfigV2).notes ?? "",
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getVersionConfig(
    tenantId: string,
    version: number,
  ): Promise<PricingConfigV2> {
    const [row] = await this.db
      .select()
      .from(pricingConfigs)
      .where(
        and(
          eq(pricingConfigs.tenantId, tenantId),
          eq(pricingConfigs.version, version),
          this.base(),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ResourceNotFoundError(`Pricing config v${version} not found`);
    }
    return parseConfig(row);
  }

  private async resolveSelector(
    tenantId: string,
    selector: PricingConfigSelector,
  ): Promise<{ label: string; config: PricingConfigV2 }> {
    switch (selector.kind) {
      case "inline":
        return {
          label: "Unsaved changes",
          config: PricingConfigV2Schema.parse(selector.config),
        };
      case "version": {
        const config = await this.getVersionConfig(tenantId, selector.version);
        return { label: `Version ${selector.version}`, config };
      }
      case "published": {
        const published = await this.getPublished(tenantId);
        return {
          label: `Published v${published.version}`,
          config: published.config,
        };
      }
      case "draft":
      default: {
        const draft = await this.getDraft(tenantId);
        return { label: `Draft v${draft.version}`, config: draft.config };
      }
    }
  }

  /**
   * Prices a hypothetical quote for the admin calculator. Pure math on top of
   * a stored config — nothing is persisted, so staff can experiment freely.
   */
  async preview(command: PreviewQuoteV2): Promise<PreviewQuoteV2Response> {
    const { tenantId } = command.context;
    const using = await this.resolveSelector(tenantId, command.using);
    const comparison = command.compareWith
      ? await this.resolveSelector(tenantId, command.compareWith)
      : null;

    const usingResult: QuotePreviewResult = {
      label: using.label,
      configVersion: using.config.version,
      configStatus: using.config.status,
      breakdown: calculateQuoteV2(command.quote, using.config),
    };

    if (!comparison) {
      return { using: usingResult, comparison: null, differences: [] };
    }

    const comparisonResult: QuotePreviewResult = {
      label: comparison.label,
      configVersion: comparison.config.version,
      configStatus: comparison.config.status,
      breakdown: calculateQuoteV2(command.quote, comparison.config),
    };

    const a = usingResult.breakdown.totals;
    const b = comparisonResult.breakdown.totals;
    const rows: Array<[string, number, number]> = [
      ["Garments", a.merchandiseMinor, b.merchandiseMinor],
      ["Decoration", a.decorationMinor, b.decorationMinor],
      ["Setup", a.setupMinor, b.setupMinor],
      ["Packing", a.packingMinor, b.packingMinor],
      ["Shipping", a.shippingMinor, b.shippingMinor],
      ["Rush", a.rushMinor, b.rushMinor],
      ["Total", a.totalMinor, b.totalMinor],
    ];

    return {
      using: usingResult,
      comparison: comparisonResult,
      differences: rows.map(([label, usingMinor, comparisonMinor]) => ({
        label,
        usingMinor,
        comparisonMinor,
        deltaMinor: usingMinor - comparisonMinor,
      })),
    };
  }

  async restoreAsDraft(
    command: RestorePricingConfigV2Draft,
    actor: Actor,
  ): Promise<PricingConfigV2DraftResponse> {
    const config = await this.getVersionConfig(
      command.context.tenantId,
      command.version,
    );
    return this.upsertDraft(
      {
        context: command.context,
        config: { ...config, status: "draft" },
      },
      actor,
    );
  }
}
