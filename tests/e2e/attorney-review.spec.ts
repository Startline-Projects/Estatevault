import { test, expect } from "@playwright/test";

test.describe("@admin attorney review flow", () => {
  test.fixme("attorney sees pending review queue", async ({ page }) => {
    // TODO: login as review attorney, visit /admin/reviews
  });

  test.fixme("attorney approves review — client notified via email", async ({ page }) => {
    // TODO: open /admin/review/[id], click approve, assert Resend mock
  });

  test.fixme("attorney requests changes — client dashboard shows status", async ({ page }) => {
    // TODO
  });

  test.fixme("attorney earns $300 add-on revenue on approval", async ({ page }) => {
    // TODO: assert revenue row, attorney payout = 300 (Core Rule 5)
  });

  test.fixme("attorney cannot review own client", async ({ page }) => {
    // TODO: 403 / hidden
  });
});
