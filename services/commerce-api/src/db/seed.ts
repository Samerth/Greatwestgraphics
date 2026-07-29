import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { DEFAULT_PRICING_CONFIG_V1 } from "@gwg/pricing";
import { createDatabase } from "./client.js";
import {
  accountPeople,
  accounts,
  catalogSettings,
  categories,
  people,
  pricingConfigs,
  stores,
  tenants,
} from "./schema.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const ids = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  storeId: "33333333-3333-4333-8333-333333333333",
  customerPersonId: "44444444-4444-4444-8444-444444444444",
  accountPersonId: "55555555-5555-4555-8555-555555555555",
  pricingConfigId: "66666666-6666-4666-8666-666666666666",
  catalogSettingsId: "77777777-7777-4777-8777-777777777777",
} as const;

/** Coastal Reign nav structure only (names/slugs) — no copy/design. */
const coastalCategories: Array<{ slug: string; name: string; sortOrder: number }> =
  [
    { slug: "t-shirts", name: "T-Shirts", sortOrder: 10 },
    { slug: "hoodies-and-crewnecks", name: "Hoodies and Crewnecks", sortOrder: 20 },
    { slug: "hats", name: "Hats", sortOrder: 30 },
    { slug: "tote-bags", name: "Tote Bags", sortOrder: 40 },
    { slug: "jackets", name: "Jackets", sortOrder: 50 },
    { slug: "vests", name: "Vests", sortOrder: 60 },
    { slug: "jerseys", name: "Jerseys", sortOrder: 70 },
    { slug: "drinkware", name: "Drinkware", sortOrder: 80 },
    { slug: "made-in-canada", name: "Made In Canada", sortOrder: 90 },
    { slug: "swag-boxes", name: "Swag Boxes", sortOrder: 100 },
    { slug: "eco-friendly", name: "Eco-Friendly", sortOrder: 110 },
    { slug: "notebooks", name: "Notebooks", sortOrder: 120 },
    { slug: "technology", name: "Technology", sortOrder: 130 },
    { slug: "socks", name: "Socks", sortOrder: 140 },
    { slug: "patches", name: "Patches", sortOrder: 150 },
    { slug: "and-more", name: "And More...", sortOrder: 160 },
  ];

const database = createDatabase(databaseUrl);
try {
  await database.db
    .insert(tenants)
    .values({ id: ids.tenantId, name: "Great West Graphics Development" })
    .onConflictDoNothing();
  await database.db
    .insert(accounts)
    .values({
      id: ids.accountId,
      tenantId: ids.tenantId,
      name: "Development Customer",
    })
    .onConflictDoNothing();
  await database.db
    .insert(stores)
    .values({
      id: ids.storeId,
      tenantId: ids.tenantId,
      accountId: ids.accountId,
      name: "Development Storefront",
      slug: "development",
    })
    .onConflictDoNothing();
  await database.db
    .insert(people)
    .values({
      id: ids.customerPersonId,
      tenantId: ids.tenantId,
      email: "customer@example.test",
      displayName: "Development Customer",
    })
    .onConflictDoNothing();
  await database.db
    .insert(accountPeople)
    .values({
      id: ids.accountPersonId,
      tenantId: ids.tenantId,
      accountId: ids.accountId,
      personId: ids.customerPersonId,
    })
    .onConflictDoNothing();
  await database.db
    .insert(pricingConfigs)
    .values({
      id: ids.pricingConfigId,
      tenantId: ids.tenantId,
      version: 1,
      status: "published",
      config: DEFAULT_PRICING_CONFIG_V1,
      publishedAt: new Date(),
      createdBy: { type: "system", displayName: "seed" },
      source: { system: "commerce_api" },
    })
    .onConflictDoNothing();
  await database.db
    .insert(catalogSettings)
    .values({
      id: ids.catalogSettingsId,
      tenantId: ids.tenantId,
      retailMarkup: "2.0",
      brandAllowlist: [],
      storageConfig: {},
      createdBy: { type: "system", displayName: "seed" },
      source: { system: "commerce_api" },
    })
    .onConflictDoNothing();

  for (const category of coastalCategories) {
    await database.db
      .insert(categories)
      .values({
        tenantId: ids.tenantId,
        slug: category.slug,
        name: category.name,
        sortOrder: category.sortOrder,
        createdBy: { type: "system", displayName: "seed" },
        source: { system: "commerce_api" },
      })
      .onConflictDoNothing();
  }

  console.log(
    "Seeded commerce scope, pricing v1, catalog settings, and Coastal category structure.",
  );
} finally {
  await database.close();
}
