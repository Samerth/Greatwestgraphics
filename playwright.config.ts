import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const seededStoreEnv = {
  COMMERCE_API_BASE_URL: "http://127.0.0.1:4000",
  COMMERCE_DEFAULT_TENANT_ID: "11111111-1111-4111-8111-111111111111",
  COMMERCE_DEFAULT_ACCOUNT_ID: "22222222-2222-4222-8222-222222222222",
  COMMERCE_DEFAULT_STORE_ID: "33333333-3333-4333-8333-333333333333",
  COMMERCE_DEFAULT_STORE_SLUG: "development",
  COMMERCE_DEFAULT_STORE_NAME: "Development Storefront",
  CUSTOMER_SESSION_SECRET:
    process.env.CUSTOMER_SESSION_SECRET ??
    "e2e-customer-session-secret-at-least-32",
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    colorScheme: "light",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "npm run start --workspace @gwg/commerce-api",
          url: "http://127.0.0.1:4000/ready",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `npm run start -- --port ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: seededStoreEnv,
        },
      ],
});
