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
  "/api/partner/revenue-details",
  "/api/sales/partners",
  "/api/sales/dashboard",
  "/api/sales/commission",
  "/api/sales/overview",
  "/api/sales/my-commission",
  "/api/sales/prospects",
  "/api/client/documents",
  "/api/client/funding-checklist",
  "/api/client/settings",
  "/api/client/quiz-latest",
  "/api/auth/login-routing",
  "/api/sales/my-platform-commission",
  "/api/attorney/reviews",
  "/api/attorney/pipeline",
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

test.describe("B2 partner mutations — unauthenticated", () => {
  test("PATCH /api/partner/me rejects anonymous", async ({ request }) => {
    const res = await request.patch("/api/partner/me", {
      data: { onboarding_step: 4 },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  test("POST /api/partner/invite-client rejects anonymous", async ({ request }) => {
    const res = await request.post("/api/partner/invite-client", {
      data: { client_email: "x@example.com" },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  test("POST /api/partner/apply-promo rejects anonymous", async ({ request }) => {
    const res = await request.post("/api/partner/apply-promo", { maxRedirects: 0 });
    expect(BLOCKED).toContain(res.status());
  });

  test("POST /api/partner/logo rejects anonymous", async ({ request }) => {
    const res = await request.post("/api/partner/logo", { maxRedirects: 0 });
    expect(BLOCKED).toContain(res.status());
  });

  test("PATCH /api/profile/me rejects anonymous", async ({ request }) => {
    const res = await request.patch("/api/profile/me", {
      data: { full_name: "x" },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  const FOREIGN = "00000000-0000-0000-0000-000000000000";

  test("GET /api/sales/partners/:id rejects anonymous", async ({ request }) => {
    const res = await request.get(`/api/sales/partners/${FOREIGN}`, { maxRedirects: 0 });
    expect(BLOCKED).toContain(res.status());
  });

  test("PATCH /api/sales/partners/:id rejects anonymous", async ({ request }) => {
    const res = await request.patch(`/api/sales/partners/${FOREIGN}`, {
      data: { status: "active" },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  test("POST /api/sales/partners/:id/apply-promo rejects anonymous", async ({ request }) => {
    const res = await request.post(`/api/sales/partners/${FOREIGN}/apply-promo`, {
      data: { promo_code: "TEST" },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  test("PATCH /api/sales/leads/:id rejects anonymous", async ({ request }) => {
    const res = await request.patch(`/api/sales/leads/${FOREIGN}`, {
      data: { status: "contacted" },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  test("POST /api/sales/attorney-verification rejects anonymous", async ({ request }) => {
    const res = await request.post("/api/sales/attorney-verification", {
      data: { partnerId: FOREIGN, action: "activate" },
      maxRedirects: 0,
    });
    expect(BLOCKED).toContain(res.status());
  });

  test("POST /api/partner/certify rejects anonymous", async ({ request }) => {
    const res = await request.post("/api/partner/certify", { maxRedirects: 0 });
    expect(BLOCKED).toContain(res.status());
  });
});

test.describe("B2 sales endpoints — authenticated sales rep", () => {
  test("GET /api/sales/partners returns managed partners", { tag: "@sales" }, async ({ page }) => {
    await loginAs(page, TEST_USERS.salesRep.email, TEST_USERS.salesRep.password);
    const res = await page.request.get("/api/sales/partners");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.partners)).toBe(true);
  });
});

test.describe("B2 client endpoints — authenticated client", () => {
  test("GET /api/client/documents returns the client's documents", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);
    const res = await page.request.get("/api/client/documents");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("documents");
    expect(Array.isArray(body.documents)).toBe(true);
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
