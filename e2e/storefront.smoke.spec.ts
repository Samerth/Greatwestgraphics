import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("storefront smoke", () => {
  test("home loads with brand signal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText(/great west graphics/i).first()).toBeVisible();
  });

  test("quote page prices an order and offers the cart", async ({ page }) => {
    await page.goto("/quote");
    await expect(
      page.getByRole("button", { name: /add to cart & continue/i }),
    ).toBeVisible();
    // A price proves the engine ran, not just that the page rendered.
    await expect(page.getByText(/^\$[\d,]+\.\d{2}$/).first()).toBeVisible();
  });

  test("cart empty state is reachable", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible();
  });

  test("contact form is present", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  for (const route of ["/", "/quote", "/cart", "/contact"]) {
    test(`${route} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(blocking).toEqual([]);
    });
  }

  test("quote builder visual baseline", async ({ page }) => {
    await page.goto("/quote");
    await expect(page.getByRole("button", { name: /add to cart & continue/i })).toBeVisible();
    await expect(page.locator("main")).toHaveScreenshot("quote-builder.png");
  });
});
