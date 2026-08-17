import { defineConfig } from "vitest/config";

/**
 * Without a config of its own this package inherited the repository root's,
 * whose `include` is pinned to `lib/**` for the web tier. Nothing in this
 * package lives under `lib/`, so vitest found no test files here and exited
 * non-zero — which read as a broken build while the real cost was quieter:
 * the quote engine's own tests, the V2 grid among them, were never run.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
