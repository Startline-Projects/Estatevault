import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../fixtures/users";
import { loginAs } from "./helpers/auth";

test.describe("/api/subscription/status", () => {
  test("blocks unauthenticated (redirect or 401)", async ({ request }) => {
    const res = await request.get("/api/subscription/status", { maxRedirects: 0 });
    expect([301, 302, 307, 401]).toContain(res.status());
  });

  test("returns status payload for authenticated client", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    const res = await page.request.get("/api/subscription/status");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("canAmendFree");
    expect(body).toHaveProperty("canUseFarewell");
    expect(typeof body.canAmendFree).toBe("boolean");
  });
});

test.describe("/api/partner/revenue", () => {
  test("blocks unauthenticated", async ({ request }) => {
    const res = await request.get("/api/partner/revenue", { maxRedirects: 0 });
    expect([301, 302, 307, 401, 403]).toContain(res.status());
  });

  test("returns earnings shape for partner", async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.request.get("/api/partner/revenue");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // tolerate field naming variations across versions
    const has = (k: string) => Object.keys(body).some((x) => x.toLowerCase().includes(k));
    expect(has("earning") || has("total") || has("revenue")).toBe(true);
  });

  test("client cannot access /api/partner/revenue", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    const res = await page.request.get("/api/partner/revenue", { maxRedirects: 0 });
    expect([301, 302, 307, 401, 403, 404]).toContain(res.status());
  });
});
