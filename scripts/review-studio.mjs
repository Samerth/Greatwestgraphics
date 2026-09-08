#!/usr/bin/env node
/**
 * One command to review the experimental Design Studio identity try-out.
 * Catalog/API is optional — the fallback t-shirt is enough to generate a mark.
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

for (const workspace of ["@gwg/contracts", "@gwg/pricing"]) {
  const result = spawnSync("npm", ["run", "build", "--workspace", workspace], {
    stdio: "inherit",
  });
  if (result.status) process.exit(result.status ?? 1);
}

const host = "127.0.0.1";
const port = "3000";
console.log(`\nDesign Studio: http://${host}:${port}/design`);
console.log("Images → Try an identity mark (experimental)\n");

const child = spawn(
  "npx",
  ["next", "dev", "--hostname", host, "--port", port],
  { stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
