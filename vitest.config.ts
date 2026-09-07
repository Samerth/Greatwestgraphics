import path from "node:path";
import { defineConfig } from "vitest/config";

// The web tier had no runner of its own. `include` is pinned to `lib/**` so
// that `npm test` — which fans out to the workspaces — keeps being the only
// thing that runs the commerce-api suite, and nothing is executed twice.
// vitest itself is hoisted here from the @gwg/commerce-api workspace rather
// than declared at the root, to avoid touching the lockfile for a dev tool.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's own `"@/*": ["./*"]` — every file under
    // `lib/**` compiles fine against that path mapping (tsc, Next's own
    // webpack/SWC resolution) but vitest doesn't read tsconfig `paths` on
    // its own, so any test file whose import chain reaches a bare `@/...`
    // import failed at run time with "Cannot find package '@/...'" even
    // though typecheck and the app itself were both clean. Caught this via
    // a real test failure (catalog-card.test.ts) after extracting shared
    // pricing logic into a lib file that imports from `@/lib/utils/...`.
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
