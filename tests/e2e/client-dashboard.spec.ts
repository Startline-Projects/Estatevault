import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { TEST_USERS } from "../fixtures/users";

/**
 * Smoke coverage for every authenticated client dashboard route.
 * Tolerant assertions — we care about "no 5xx, no crash, not bounced to login",
 * not exact content (content depends on seeded orders / subscription state).
 */

const CLIENT_ROUTES = [
  "/dashboard",
  "/dashboard/documents",
  "/dashboard/amendment",
  "/dashboard/life-events",
  "/dashboard/funding-checklist",
  "/dashboard/settings",
  "/dashboard/vault",
  "/dashboard/vault/farewell",
  "/dashboard/vault/trustees",
];

test.describe("client dashboard — smoke", () => {
  for (const route of CLIENT_ROUTES) {
    test(`${route} loads for authenticated client`, async ({ page }) => {
      await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
      const res = await page.goto(route);
      expect(res?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/auth\/login/);
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }

  test("dashboard sidebar exposes core navigation", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /documents/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
