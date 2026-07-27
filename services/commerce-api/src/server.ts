import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { DevelopmentHeaderAuth } from "./auth.js";
import { loadEnvironment } from "./config.js";
import { createDatabase } from "./db/client.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const environment = loadEnvironment();
const database = createDatabase(environment.DATABASE_URL);
const app = buildApp({
  db: database.db,
  auth: new DevelopmentHeaderAuth(environment.NODE_ENV === "production"),
  environment,
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down commerce API");
  await app.close();
  await database.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({
    host: environment.COMMERCE_API_HOST,
    port: environment.COMMERCE_API_PORT,
  });
} catch (error) {
  app.log.fatal({ error }, "Commerce API failed to start");
  await database.close();
  process.exitCode = 1;
}
