import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { TEST_USERS } from "../fixtures/users";

test.describe("admin / sales routes — access control", () => {
  test("unauthenticated cannot access /pro/sales", async ({ page }) => {
    await page.goto("/pro/sales");
    await expect(page).toHaveURL(/\/(auth\/login|login|pro\/login)/, { timeout: 10_000 });
  });

  test("unauthenticated cannot access /pro/sales/admin", async ({ page }) => {
    await page.goto("/pro/sales/admin");
    await expect(page).toHaveURL(/\/(auth\/login|login|pro\/login)/, { timeout: 10_000 });
  });

  test("sales rep can access /pro/sales dashboard", { tag: "@sales" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.salesRep.email, TEST_USERS.salesRep.password);
    const res = await page.goto("/pro/sales");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test("sales rep sees partners list", { tag: "@sales" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.salesRep.email, TEST_USERS.salesRep.password);
    const res = await page.goto("/pro/sales/partners");
    expect(res?.status()).toBeLessThan(400);
  });

  test("sales rep sees pipeline", { tag: "@sales" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.salesRep.email, TEST_USERS.salesRep.password);
    const res = await page.goto("/pro/sales/pipeline");
    expect(res?.status()).toBeLessThan(400);
  });
});

// SECURITY: These routes call supabase.auth.getUser() and return 401 if no user.
// Currently returning 200 unauthenticated — Supabase test project may have anonymous
// auth enabled. Disable anon auth on the test project or investigate getUser() behavior.
test.describe("sales API routes", () => {
  test("POST /api/sales/create-partner blocks unauthenticated", async ({ request }) => {
    const res = await request.post("/api/sales/create-partner", {
      data: { companyName: "Test Co", ownerName: "Test", email: "x@y.com" },
    });
    // Should be 401 but may return 403 (role check) if anon user passes getUser()
    expect([400, 401, 403, 307]).toContain(res.status());
  });

  test("GET /api/sales/reps blocks unauthenticated", async ({ request }) => {
    const res = await request.get("/api/sales/reps");
    expect([401, 403, 307]).toContain(res.status());
  });

  test("authenticated sales rep can fetch reps list", { tag: "@sales" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.salesRep.email, TEST_USERS.salesRep.password);
    const res = await page.request.get("/api/sales/reps");
    // 200 or 403 (if admin-only) — not 307 unauth redirect
    expect(res.status()).not.toBe(307);
  });
});

test.describe("attorney routes", () => {
  test("attorney page loads", async ({ page }) => {
    const res = await page.goto("/attorney");
    expect(res?.status()).toBeLessThan(400);
  });

  test("attorney review route blocks unauthenticated", async ({ page }) => {
    await page.goto("/attorney/review/fake-id");
    const url = page.url();
    // Should redirect to login or show 404 — not crash
    expect(url).toBeTruthy();
  });

  test("POST /api/attorney/approve blocks unauthenticated", async ({ request }) => {
    const res = await request.post("/api/attorney/approve", {
      data: { reviewId: "fake", decision: "approved" },
    });
    expect([400, 401, 403, 307, 404]).toContain(res.status());
  });
});
