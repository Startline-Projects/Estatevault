import { test, expect } from "@playwright/test";

test.describe("stripe webhooks", () => {
  test.fixme("checkout.session.completed — order marked paid", async ({ request }) => {
    // TODO: POST signed Stripe event to /api/webhooks/stripe, assert order.status
  });

  test.fixme("invalid signature rejected 400", async ({ request }) => {
    // TODO
  });

  test.fixme("duplicate event ignored — idempotent", async ({ request }) => {
    // TODO: send same event twice, assert single revenue row
  });

  test.fixme("customer.subscription.updated — vault subscription state synced", async ({ request }) => {
    // TODO
  });

  test.fixme("customer.subscription.deleted — vault revoked", async ({ request }) => {
    // TODO
  });

  test.fixme("payment_intent.payment_failed — order flagged", async ({ request }) => {
    // TODO
  });

  test.fixme("revenue split rows created — partner + attorney payouts", async ({ request }) => {
    // TODO: assert amounts match Core Rules 5+6
  });
});
