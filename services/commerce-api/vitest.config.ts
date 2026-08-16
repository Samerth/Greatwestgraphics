import { defineConfig } from "vitest/config";

// Without a config of its own this workspace inherits the repo-root one, whose
// `include` is pinned to the web tier's `lib/**`. `npm test` here then reports
// success having run nothing at all, which is the worst possible failure mode
// for a test suite. Pin the workspace's own tests explicitly.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
