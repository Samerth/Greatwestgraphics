import { defineConfig } from "vitest/config";

// The web tier had no runner of its own. `include` is pinned to `lib/**` so
// that `npm test` — which fans out to the workspaces — keeps being the only
// thing that runs the commerce-api suite, and nothing is executed twice.
// vitest itself is hoisted here from the @gwg/commerce-api workspace rather
// than declared at the root, to avoid touching the lockfile for a dev tool.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
