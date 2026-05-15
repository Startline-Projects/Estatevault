import { test, expect } from "@playwright/test";

/**
 * Unauthenticated auth-guard sweep across sensitive API routes.
 * Every route below must reject anonymous callers — never 2xx.
 * Acceptable: 4xx (auth/validation) or 3xx (redirect to login).
 */

const BLOCKED = [400, 401, 403, 404, 307, 302, 301];

const GET_ROUTES = [
  "/api/subscription/status",
  "/api/partner/revenue",
  "/api/partner/clients",
  "/api/vault/items",
  "/api/vault/trustees",
  "/api/crypto/bundle",
  "/api/crypto/pubkey",
  "/api/documents/status?order_id=fake",
  "/api/trustee/vault/items",
];

const POST_ROUTES = [
  "/api/documents/generate",
  "/api/vault/items",
  "/api/vault/upload-url",
  "/api/checkout/will",
  "/api/checkout/trust",
  "/api/partner/add-domain",
  "/api/crypto/bootstrap",
  "/api/trustee/unlock-otp",
];

test.describe("API auth guards — unauthenticated GET", () => {
  for (const route of GET_ROUTES) {
    test(`GET ${route} rejects anonymous`, async ({ request }) => {
      const res = await request.get(route, { maxRedirects: 0 });
      expect(BLOCKED).toContain(res.status());
    });
  }
});

test.describe("API auth guards — unauthenticated POST", () => {
  for (const route of POST_ROUTES) {
    test(`POST ${route} rejects anonymous`, async ({ request }) => {
      const res = await request.post(route, { data: {}, maxRedirects: 0 });
      expect(BLOCKED).toContain(res.status());
    });
  }
});

test.describe("Stripe webhook — signature enforcement", () => {
  test("POST /api/webhooks/stripe rejects unsigned payload", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      data: { type: "checkout.session.completed" },
      maxRedirects: 0,
    });
    // Missing/invalid stripe-signature → 400. Never 200.
    expect(res.status()).not.toBe(200);
    expect([400, 401, 403]).toContain(res.status());
  });
});
