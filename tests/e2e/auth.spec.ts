import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../fixtures/users";
import { loginAs, logout } from "./helpers/auth";

test.describe("auth — UI flows", () => {
  test("login page renders email + password fields", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("nope@nowhere.test");
    await page.getByLabel("Password").fill("wrongpass");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator("text=/invalid|incorrect|credentials/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("partner login routes to /pro/dashboard or onboarding", { tag: "@pro" }, async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(TEST_USERS.partnerBasic.email);
    await page.getByLabel("Password").fill(TEST_USERS.partnerBasic.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/pro\/(dashboard|onboarding)/, { timeout: 15_000 });
  });

  test("client login routes to /dashboard", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(TEST_USERS.client.email);
    await page.getByLabel("Password").fill(TEST_USERS.client.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe("auth — programmatic", () => {
  test("loginAs helper grants access to /dashboard", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    const res = await page.goto("/dashboard");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test("logout clears cookies and blocks /dashboard", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/(auth\/login|login)/, { timeout: 10_000 });
  });
});
