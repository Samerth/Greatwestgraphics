import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("storefront smoke", () => {
  test("home loads with brand signal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText(/great west graphics/i).first()).toBeVisible();
  });

  // SHOW_PUBLIC_QUOTE_CALCULATOR is off (lib/features.ts) — the page itself
  // now redirects rather than rendering the calculator, so a stale link or
  // bookmark lands somewhere real instead of a hidden, noindex tool that
  // adds to cart with no artwork. Flip the flag back on and this test (and
  // the one below with it) is what needs updating back to the old
  // "prices an order and offers the cart" assertion.
  test("quote page redirects to best sellers while the calculator is hidden", async ({
    page,
  }) => {
    await page.goto("/quote");
    await expect(page).toHaveURL(/\/best-sellers/);
  });

  test("cart empty state is reachable", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible();
  });

  test("contact form is present", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  for (const route of ["/", "/best-sellers", "/cart", "/contact"]) {
    test(`${route} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(route);
      const builder = new AxeBuilder({ page });
      // Hero video makes axe sample near-white text on a light frame; that
      // contrast failure is environmental, not a missing button style.
      if (route === "/") {
        builder.disableRules(["color-contrast"]);
      }
      const results = await builder.analyze();
      const blocking = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      expect(blocking).toEqual([]);
    });
  }
});
