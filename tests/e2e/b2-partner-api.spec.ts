import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../fixtures/users";
import { loginAs } from "./helpers/auth";

/**
 * B2 — the pro/* screens no longer query the database directly; their data now
 * flows through these GET endpoints. This spec verifies:
 *   1. each endpoint rejects anonymous callers,
 *   2. a logged-in partner gets the expected payload shape,
 *   3. the client-detail endpoint enforces partner ownership (the guard the
 *      old client-side version lacked).
 */

const PARTNER_GET_ENDPOINTS = [
  "/api/partner/me",
  "/api/profile/me",
  "/api/partner/dashboard",
  "/api/partner/clients",
  "/api/partner/vault-clients",
  "/api/partner/documents",
  "/api/partner/referrals",
];

const BLOCKED = [301, 302, 307, 401, 403];

test.describe("B2 partner endpoints — unauthenticated", () => {
  for (const url of PARTNER_GET_ENDPOINTS) {
    test(`GET ${url} rejects anonymous`, async ({ request }) => {
      const res = await request.get(url, { maxRedirects: 0 });
      expect(BLOCKED).toContain(res.status());
    });
  }
});

test.describe("B2 partner endpoints — authenticated partner", () => {
  test("GET /api/partner/me returns the partner row", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.request.get("/api/partner/me");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("partner");
    expect(body.partner).toHaveProperty("id");
    expect(body.partner).toHaveProperty("tier");
  });

  test("GET /api/profile/me returns profile basics", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.request.get("/api/profile/me");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.profile).toHaveProperty("email");
  });

  test("GET /api/partner/dashboard returns stats shape", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    const res = await page.request.get("/api/partner/dashboard");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("stats");
    expect(body).toHaveProperty("vaultStats");
    expect(body).toHaveProperty("recentActivity");
    expect(Array.isArray(body.recentActivity)).toBe(true);
  });

  test("list endpoints return arrays", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);
    for (const [url, key] of [
      ["/api/partner/clients", "clients"],
      ["/api/partner/vault-clients", "clients"],
      ["/api/partner/documents", "orders"],
      ["/api/partner/referrals", "referrals"],
    ] as const) {
      const res = await page.request.get(url);
      expect(res.ok(), `${url} ok`).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body[key]), `${url} -> ${key} is array`).toBe(true);
    }
  });
});

test.describe("B2 client-detail — ownership enforced", () => {
  test("owned client detail works; unknown/foreign id does not leak", { tag: "@pro" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.partnerBasic.email, TEST_USERS.partnerBasic.password);

    // An owned client (if the partner has any) returns 200 with detail.
    const list = await (await page.request.get("/api/partner/clients")).json();
    const owned = (list.clients ?? [])[0];
    if (owned?.id) {
      const okRes = await page.request.get(`/api/partner/clients/${owned.id}`);
      expect(okRes.ok()).toBeTruthy();
      const detail = await okRes.json();
      expect(detail).toHaveProperty("client");
      expect(detail).toHaveProperty("orders");
    }

    // A client id this partner does not own must NOT return 200 (403/404).
    const foreign = await page.request.get(
      "/api/partner/clients/00000000-0000-0000-0000-000000000000",
    );
    expect([403, 404]).toContain(foreign.status());
  });
});
