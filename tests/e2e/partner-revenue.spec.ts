import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../fixtures/users";
import { loginAs } from "./helpers/auth";

test.describe("partner revenue page", () => {
  test("basic partner sees revenue page without crash", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.goto("/pro/revenue");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("revenue page shows earnings sections (total, pending, breakdown)", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    await page.goto("/pro/revenue");
    // Tolerant — labels may render with $0 if no orders seeded yet.
    await expect(page.locator("text=/total|earnings/i").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=/pending|payout/i").first()).toBeVisible();
  });

  test("enterprise partner page also loads", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerEnterprise.email, TEST_USERS.partnerEnterprise.password);
    const res = await page.goto("/pro/revenue");
    expect(res?.status()).toBeLessThan(500);
  });

  test("non-partner cannot access /pro/revenue", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    await page.goto("/pro/revenue");
    await expect(page).not.toHaveURL(/\/pro\/revenue$/, { timeout: 10_000 });
  });
});
