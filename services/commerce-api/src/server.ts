import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { DevelopmentHeaderAuth, ServiceTokenAuth } from "./auth.js";
import { loadEnvironment } from "./config.js";
import { createDatabase } from "./db/client.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const environment = loadEnvironment();
const database = createDatabase(environment.DATABASE_URL);
const isProduction = environment.NODE_ENV === "production";

// Deliberately not fatal when the token is missing in production: the service
// still answers /health and /ready, so a half-configured deployment reports the
// reason instead of crash-looping with the cause buried in container logs.
const auth = environment.COMMERCE_SERVICE_TOKEN
  ? new ServiceTokenAuth(environment.COMMERCE_SERVICE_TOKEN)
  : new DevelopmentHeaderAuth(isProduction);

const app = buildApp({ db: database.db, auth, environment });

if (isProduction && !environment.COMMERCE_SERVICE_TOKEN) {
  app.log.error(
    "COMMERCE_SERVICE_TOKEN is not set. Every tenant-scoped route will refuse requests until it is.",
  );
}

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
