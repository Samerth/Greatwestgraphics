import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { loadEnvironment } from "../config.js";
import { createDatabase } from "../db/client.js";
import { SanmarClient } from "../adapters/sanmar/client.js";
import { SanmarSyncService } from "../adapters/sanmar/sync-service.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

async function main() {
  const environment = loadEnvironment();
  if (!environment.SANMAR_ACCOUNT_ID || !environment.SANMAR_API_PASSWORD) {
    throw new Error("SANMAR_ACCOUNT_ID and SANMAR_API_PASSWORD are required");
  }
  const tenantId =
    process.env.COMMERCE_DEV_TENANT_ID ||
    "11111111-1111-4111-8111-111111111111";
  const type = process.argv.includes("--inventory") ? "inventory" : "full";
  const { db, close } = createDatabase(environment.DATABASE_URL);
  const client = new SanmarClient(
    environment.SANMAR_ACCOUNT_ID,
    environment.SANMAR_API_PASSWORD,
    environment.SANMAR_API_BASE_URL || "https://api.sanmarcanada.com",
  );
  const sync = new SanmarSyncService(db, client);
  const actor = {
    type: "system" as const,
    displayName: "sync:sanmar",
  };
  console.log(`Starting ${type} Sanmar sync for tenant ${tenantId}…`);
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
