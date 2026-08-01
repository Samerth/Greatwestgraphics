import { and, asc, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type {
  Actor,
  PricingConfig,
  PricingConfigDraftResponse,
  PricingConfigVersionSummary,
  PublishPricingConfig,
  PublishedPricingConfigResponse,
  RestorePricingConfigDraft,
  UpsertPricingConfigDraft,
} from "@gwg/contracts";
import { PricingConfigSchema } from "@gwg/contracts";
import { DEFAULT_PRICING_CONFIG_V1 } from "@gwg/pricing";
import type { CommerceDatabase } from "../db/client.js";
import { idempotencyKeys, pricingConfigs } from "../db/schema.js";
import {
  DataIntegrityError,
  IdempotencyConflictError,
  ResourceNotFoundError,
} from "./job-request-service.js";

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toPublished(
  row: typeof pricingConfigs.$inferSelect,
): PublishedPricingConfigResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    version: row.version,
    status: "published",
    publishedAt: row.publishedAt?.toISOString() ?? null,
    config: {
      ...PricingConfigSchema.parse(row.config),
      status: "published",
    },
  };
}

function toDraft(
  row: typeof pricingConfigs.$inferSelect,
): PricingConfigDraftResponse {
  if (row.status !== "draft") {
    throw new DataIntegrityError("Expected a draft pricing config row");
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    version: row.version,
    status: "draft",
    config: PricingConfigSchema.parse(row.config),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Applies a store's negotiated storewide adjustment (e.g. -0.1 for a 10%
 * discount, 0.05 for a 5% markup) on top of the tenant's published config.
 * Only markup/decoration multipliers scale — flat fees (setup, digitizing,
 * packing, artwork minimum) are cost-recovery, not margin, and stay as-is.
 */
export function applyStorePricingAdjustment(
  config: PricingConfig,
  percent: number | null,
): PricingConfig {
  if (!percent) return config;
  const scale = 1 + percent;
  return {
    ...config,
    multipliers: {
      ...config.multipliers,
      garmentMarkup: config.multipliers.garmentMarkup * scale,
      screenPrint: config.multipliers.screenPrint * scale,
      embroidery: config.multipliers.embroidery * scale,
      dtf: config.multipliers.dtf * scale,
    },
  };
}

export class PricingConfigService {
  constructor(private readonly db: CommerceDatabase) {}

  async getPublished(
    tenantId: string,
  ): Promise<PublishedPricingConfigResponse> {
    const [row] = await this.db
      .select()
      .from(pricingConfigs)
      .where(
        and(
          eq(pricingConfigs.tenantId, tenantId),
          eq(pricingConfigs.status, "published"),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundError(
        "No published pricing config exists for this tenant",
      );
    }
    return toPublished(row);
  }

  async getDraft(tenantId: string): Promise<PricingConfigDraftResponse> {
    const [row] = await this.db
      .select()
      .from(pricingConfigs)
      .where(
        and(
          eq(pricingConfigs.tenantId, tenantId),
          eq(pricingConfigs.status, "draft"),
        ),
      )
      .limit(1);

    if (row) return toDraft(row);

    const published = await this.getPublished(tenantId).catch(() => null);
    const baseConfig = published?.config ?? DEFAULT_PRICING_CONFIG_V1;
    const nextVersion = (published?.version ?? 0) + 1;
    const draftConfig: PricingConfig = {
      ...structuredClone(baseConfig),
      version: nextVersion,
      status: "draft",
    };

    const [created] = await this.db
      .insert(pricingConfigs)
      .values({
        tenantId,
        version: nextVersion,
        status: "draft",
        config: draftConfig,
        createdBy: { type: "system", displayName: "pricing-bootstrap" },
        source: { system: "commerce_api" },
      })
      .returning();

    if (!created) {
      throw new DataIntegrityError("Failed to create pricing draft");
    }
    return toDraft(created);
  }

  async upsertDraft(
    command: UpsertPricingConfigDraft,
    actor: Actor,
  ): Promise<PricingConfigDraftResponse> {
    const tenantId = command.context.tenantId;
    const config = PricingConfigSchema.parse({
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
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await tx
          .update(pricingConfigs)
          .set({
            config: { ...config, version: existing.version, status: "draft" },
            updatedAt: new Date(),
            createdBy: actor,
            source: { system: "commerce_api" },
          })
          .where(eq(pricingConfigs.id, existing.id))
          .returning();
        if (!updated) {
          throw new DataIntegrityError("Failed to update pricing draft");
        }
        return toDraft(updated);
      }

      const [published] = await tx
        .select()
        .from(pricingConfigs)
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "published"),
          ),
        )
        .limit(1);
      const version = (published?.version ?? 0) + 1;
      const [created] = await tx
        .insert(pricingConfigs)
        .values({
          tenantId,
          version,
          status: "draft",
          config: { ...config, version, status: "draft" },
          createdBy: actor,
          source: { system: "commerce_api" },
        })
        .returning();
      if (!created) {
        throw new DataIntegrityError("Failed to create pricing draft");
      }
      return toDraft(created);
    });
  }

  async publish(
    command: PublishPricingConfig,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<PublishedPricingConfigResponse> {
    const { tenantId } = command.context;
    const operation = "pricing_config.publish";
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
        return toPublished(existing);
      }

      const [draft] = await tx
        .select()
        .from(pricingConfigs)
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "draft"),
          ),
        )
        .limit(1);

      if (!draft) {
        throw new ResourceNotFoundError("No draft pricing config to publish");
      }

      await tx
        .update(pricingConfigs)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "published"),
          ),
        );

      const publishedConfig: PricingConfig = {
        ...PricingConfigSchema.parse(draft.config),
        version: draft.version,
        status: "published",
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

      return toPublished(published);
    });
  }

  async listVersions(
    tenantId: string,
  ): Promise<PricingConfigVersionSummary[]> {
    const rows = await this.db
      .select()
      .from(pricingConfigs)
      .where(eq(pricingConfigs.tenantId, tenantId))
      .orderBy(desc(pricingConfigs.version), asc(pricingConfigs.createdAt));

    return rows.map((row) => ({
      id: row.id,
      version: row.version,
      status: row.status as PricingConfigVersionSummary["status"],
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getVersionConfig(
    tenantId: string,
    version: number,
  ): Promise<PricingConfig> {
    const [row] = await this.db
      .select()
      .from(pricingConfigs)
      .where(
        and(
          eq(pricingConfigs.tenantId, tenantId),
          eq(pricingConfigs.version, version),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ResourceNotFoundError(`Pricing config v${version} not found`);
    }
    return PricingConfigSchema.parse(row.config);
  }

  async restoreAsDraft(
    command: RestorePricingConfigDraft,
    actor: Actor,
  ): Promise<PricingConfigDraftResponse> {
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
