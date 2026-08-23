import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { and, eq, notInArray } from "drizzle-orm";
import { loadEnvironment } from "../config.js";
import { createDatabase } from "../db/client.js";
import { ssProductCategories, categoryOverrides } from "../db/schema.js";
import { CatalogWriter } from "../adapters/catalog/writer.js";
import { BUILTIN_VENDORS } from "../adapters/catalog/types.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

async function main() {
  const apply = process.argv.includes("--apply");
  const environment = loadEnvironment();
  const tenantId =
    process.env.COMMERCE_DEV_TENANT_ID ||
    "11111111-1111-4111-8111-111111111111";
  const { db, close } = createDatabase(environment.DATABASE_URL);
  const writer = new CatalogWriter(db);

  console.log(
    apply
      ? `Re-classifying products for tenant ${tenantId}…\n`
      : `DRY RUN — pass --apply to actually write changes.\n`,
  );

  try {
    // Never touch staff overrides.
    const overrides = await db
      .select({ productUuid: categoryOverrides.productUuid })
      .from(categoryOverrides)
      .where(eq(categoryOverrides.tenantId, tenantId));
    const overriddenIds = overrides.map((r) => r.productUuid);

    if (apply) {
      const deleted = await db
        .delete(ssProductCategories)
        .where(
          and(
            eq(ssProductCategories.tenantId, tenantId),
            eq(ssProductCategories.assignmentSource, "map"),
            overriddenIds.length
              ? notInArray(ssProductCategories.productUuid, overriddenIds)
              : undefined,
          ),
        )
        .returning({ id: ssProductCategories.id });
      console.log(`Cleared ${deleted.length} old "map" category assignments.`);
    } else {
      console.log(
        "Dry run does not delete/reassign — re-run with --apply to actually reclassify.",
      );
      return;
    }

    for (const vendor of Object.values(BUILTIN_VENDORS)) {
      const result = await writer.assignFallbackCategories(tenantId, vendor);
      console.log(
        `[${vendor}] assigned=${result.assigned} stillUnmatched=${result.unmatched}`,
      );
    }
  } finally {
    await close();
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});