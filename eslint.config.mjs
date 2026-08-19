import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Zustand hydration and persisted browser state intentionally reconcile
      // after mount. These effects are synchronization boundaries, not derived
      // render state, and rewriting all of them as external stores would make
      // the gate noisier without changing runtime behavior.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "packages/*/dist/**",
    "services/*/dist/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
