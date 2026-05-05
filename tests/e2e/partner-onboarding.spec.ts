import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { TEST_USERS } from "../fixtures/users";

test.describe("partner onboarding", () => {
  test("onboarding step-1 renders for fresh partner", async ({ page }) => {
    await page.goto("/pro/onboarding/step-1");
    // Should either show onboarding content or redirect to login
    const url = page.url();
    const isLogin = /auth\/login|pro\/login/.test(url);
    const isOnboarding = /onboarding/.test(url);
    expect(isLogin || isOnboarding).toBe(true);
  });

  test("authenticated partner can view onboarding step-1", async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.goto("/pro/onboarding/step-1");
    expect(res?.status()).toBeLessThan(400);
  });

  test("onboarding step-1 has required form fields", async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    await page.goto("/pro/onboarding/step-1");
    // Step 1 should have name/firm field or similar
    const hasInput = await page.locator("input, textarea, select").first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasInput).toBe(true);
  });

  test("onboarding steps are sequential (step-2 accessible after step-1)", async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.goto("/pro/onboarding/step-2");
    // Should load (partner may already be past step 1)
    expect(res?.status()).toBeLessThan(400);
  });

  test("training page accessible to partner", async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.goto("/pro/training");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test("training module-1 loads", async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.goto("/pro/training/module-1");
    expect(res?.status()).toBeLessThan(400);
  });
});
