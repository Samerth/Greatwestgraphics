import { config as loadDotenv } from "dotenv";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnvironment } from "../config.js";
import {
  SanmarAuthError,
  SanmarBulkLimitError,
  SanmarBulkUnauthorizedError,
  createSanmarClientFromEnv,
} from "../adapters/sanmar/client.js";

/**
 * Answers the two SanMar questions left open on 11 September without writing
 * anything to the database:
 *
 *   1. How many styles does SanMar actually list, against the 472 we hold?
 *      (getProductSellable — read-only, no daily limit.)
 *   2. Is Bulk Data entitled on this account?
 *      (getBulkData — one call per day; succeeding here spends today's call,
 *      so the result is saved to a file rather than thrown away.)
 *
 * Deliberately not the full sync. That sync upserts every active SanMar style
 * into the catalogue as step one, which on staging turns 472 styles into
 * however many SanMar sells. Whether that is wanted is a decision, and this
 * probe is what the decision gets made on.
 *
 *   npm run probe:sanmar --workspace @gwg/commerce-api
 *
 * Credentials come from the repo-root .env (gitignored). Nothing here prints
 * a credential; only presence is reported.
 */

loadDotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

function line(label: string, value: string | number) {
  console.log(`${label.padEnd(34)} ${value}`);
}

async function main() {
  const environment = loadEnvironment();

  console.log("SanMar credential presence (values never printed)");
  line("  SANMAR_ACCOUNT_ID", environment.SANMAR_ACCOUNT_ID ? "set" : "MISSING");
  line(
    "  SANMAR_LOGIN_EMAIL",
    environment.SANMAR_LOGIN_EMAIL ? "set" : "MISSING",
  );
  line(
    "  SANMAR_MEDIA_PASSWORD",
    environment.SANMAR_MEDIA_PASSWORD ? "set" : "not set (images only)",
  );
  console.log("");

  const client = createSanmarClientFromEnv(environment);
  if (!client || !environment.SANMAR_ACCOUNT_ID || !environment.SANMAR_LOGIN_EMAIL) {
    console.error(
      "Set SANMAR_ACCOUNT_ID and SANMAR_LOGIN_EMAIL in the repo-root .env first.",
    );
    process.exit(2);
  }

  // ---- Question 1: how many styles does SanMar list? -----------------------
  console.log("1. Sellable catalogue (getProductSellable ACTIVE) — read-only");
  try {
    const parts = await client.listSellableParts("ACTIVE");
    const active = parts.filter((part) => !part.discontinued);
    const styles = new Set(active.map((part) => part.styleId));
    line("  sellable parts (SKUs)", parts.length);
    line("  active parts", active.length);
    line("  unique active styles", styles.size);
    line("  we currently hold", "472 styles (audit of 11 Sep)");
    console.log("");
  } catch (error) {
    if (error instanceof SanmarAuthError) {
      console.error(
        "  AUTH FAILED — the account ID or login e-mail is wrong. Nothing else will work until this does.",
      );
      console.error(`  ${error.message}`);
      process.exit(3);
    }
    console.error("  Sellable lookup failed:", error instanceof Error ? error.message : error);
    // The client wraps the underlying failure — a connection timeout, a DNS
    // miss, a TLS error, or ATC's own fault text — in `details`. Without it
    // "SOAP request failed" tells you nothing about which of those it was.
    // Response bodies never echo credentials, and the request is not logged.
    const details = (error as { details?: unknown }).details;
    if (details) {
      console.error("  Underlying cause:", String(details).slice(0, 600));
    }
    console.error("");
    console.error(
      "  If the cause is a timeout or connection refusal, the endpoint is not accepting",
    );
    console.error(
      "  connections from this IP — ATC's EDI endpoint is known to allowlist addresses.",
    );
    process.exit(4);
  }

  // ---- Question 2: is Bulk Data entitled? ----------------------------------
  console.log("2. Bulk Data entitlement (getBulkData) — one call per day");
  try {
    const bulk = await client.getBulkProducts();
    const styles = new Set(bulk.map((row) => row.styleId));
    const withPhoto = bulk.filter((row) => Boolean(row.imageUrl)).length;
    line("  ENTITLED", "yes");
    line("  bulk rows (parts)", bulk.length);
    line("  unique styles in bulk", styles.size);
    line("  parts carrying a photo URL", withPhoto);
    // Today's one call is now spent. Keep what it returned.
    const outPath = fileURLToPath(
      new URL("../../../../sanmar-bulk-probe.json", import.meta.url),
    );
    await writeFile(outPath, JSON.stringify(bulk, null, 2), "utf8");
    line("  saved to", outPath);
    console.log("");
    console.log(
      "Bulk works. The full sync will refresh quantity, price and photos for every part in one call.",
    );
  } catch (error) {
    if (error instanceof SanmarBulkUnauthorizedError) {
      line("  ENTITLED", "NO");
      console.log("");
      console.log(
        "  Bulk Data is a separate SanMar entitlement and this account does not have it.",
      );
      console.log(
        "  The full sync still works — it falls back to per-style inventory and pricing calls —",
      );
      console.log(
        "  but photos beyond the first 50 styles need either Bulk enabled by SanMar's EDI team",
      );
      console.log("  or SANMAR_MEDIA_PASSWORD with the per-style cap raised.");
      console.log("");
      console.log("  Action: raise the entitlement request with SanMar EDI (11 Sep, action 6).");
      process.exit(0);
    }
    if (error instanceof SanmarBulkLimitError) {
      line("  ENTITLED", "yes — but today's call is already used");
      console.log("");
      console.log("  Bulk answered with its daily-limit response, which only an entitled account gets.");
      console.log("  Run the full sync tomorrow; nothing more to learn today.");
      process.exit(0);
    }
    console.error("  Bulk call failed:", error instanceof Error ? error.message : error);
    process.exit(5);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
