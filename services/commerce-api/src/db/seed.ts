import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./client.js";
import {
  accountPeople,
  accounts,
  people,
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
} as const;

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
  console.log("Seeded Phase 2 development commerce scope.");
} finally {
  await database.close();
}
