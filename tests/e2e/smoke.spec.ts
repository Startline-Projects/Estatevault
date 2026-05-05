import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(500);
});

test("partner login redirects to universal /auth/login", async ({ page }) => {
  await page.goto("/pro/login");
  await expect(page).toHaveURL(/\/auth\/login/);
});
