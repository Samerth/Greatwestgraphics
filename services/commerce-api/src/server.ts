import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { DevelopmentHeaderAuth, ServiceTokenAuth } from "./auth.js";
import { loadEnvironment } from "./config.js";
import { createDatabase } from "./db/client.js";
import {
  ResendEmailSender,
  UnconfiguredEmailSender,
} from "./notifications/email.js";
import { startOutboxDispatcher } from "./notifications/outbox-dispatcher.js";

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

// Proof decisions write outbox events inside the same transaction as the state
// change; without something draining them, neither side ever learns their turn
// has come.
const emailSender = environment.RESEND_API_KEY
  ? new ResendEmailSender(
      environment.RESEND_API_KEY,
      environment.NOTIFICATIONS_FROM_EMAIL,
    )
  : new UnconfiguredEmailSender();

if (environment.OUTBOX_DISPATCH_ENABLED && !environment.RESEND_API_KEY) {
  app.log.warn(
    "RESEND_API_KEY is not set. Notifications stay queued in outbox_events and will send once it is configured.",
  );
}
if (environment.OUTBOX_DISPATCH_ENABLED && !environment.STAFF_NOTIFICATION_EMAIL) {
  app.log.warn(
    "STAFF_NOTIFICATION_EMAIL is not set. Customer-side proof activity will not be announced to staff.",
  );
}

const dispatcher = environment.OUTBOX_DISPATCH_ENABLED
  ? startOutboxDispatcher({
      db: database.db,
      sender: emailSender,
      siteBaseUrl: environment.SITE_BASE_URL,
      staffEmail: environment.STAFF_NOTIFICATION_EMAIL ?? null,
      intervalMs: environment.OUTBOX_POLL_MS,
      logger: app.log,
    })
  : undefined;

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down commerce API");
  dispatcher?.stop();
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
