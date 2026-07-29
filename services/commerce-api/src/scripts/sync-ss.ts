import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { loadEnvironment } from "../config.js";
import { createDatabase } from "../db/client.js";
import { SsActivewearClient } from "../adapters/ss-activewear/client.js";
import { SsSyncService } from "../adapters/ss-activewear/sync-service.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

async function main() {
  const environment = loadEnvironment();
  if (!environment.SS_ACCOUNT_NUMBER || !environment.SS_API_KEY) {
    throw new Error("SS_ACCOUNT_NUMBER and SS_API_KEY are required");
  }
  const tenantId =
    process.env.COMMERCE_DEV_TENANT_ID ||
    "11111111-1111-4111-8111-111111111111";
  const type = process.argv.includes("--inventory") ? "inventory" : "full";
  const { db, close } = createDatabase(environment.DATABASE_URL);
  const client = new SsActivewearClient(
    environment.SS_ACCOUNT_NUMBER,
    environment.SS_API_KEY,
    environment.SS_API_BASE_URL || "https://api-ca.ssactivewear.com",
  );
  const sync = new SsSyncService(db, client);
  const actor = {
    type: "system" as const,
    displayName: "sync:ss",
  };
  console.log(`Starting ${type} S&S sync for tenant ${tenantId}…`);
  try {
    const result =
      type === "inventory"
        ? await sync.runInventorySync(tenantId, actor)
        : await sync.runFullSync(tenantId, actor);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await close();
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
