import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { TEST_USERS } from "../fixtures/users";

/**
 * Review-attorney portal smoke. Attorney accounts log in on the admin host
 * (login page allows user_type "review_attorney" on admin host), so this whole
 * file runs under the `admin` Playwright project.
 */

const ATTORNEY_ROUTES = [
  "/attorney/dashboard",
  "/attorney/reviews",
  "/attorney/pipeline",
  "/attorney/partners",
  "/attorney/commission",
  "/attorney/account",
  "/attorney/farewell-verification",
];

test.describe("attorney portal — smoke", { tag: "@admin" }, () => {
  for (const route of ATTORNEY_ROUTES) {
    test(`${route} loads for authenticated attorney`, async ({ page }) => {
      await loginAs(page, TEST_USERS.attorney.email, TEST_USERS.attorney.password);
      const res = await page.goto(route);
      expect(res?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/auth\/login/);
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }

  test("review/[id] with bogus id does not 5xx", async ({ page }) => {
    await loginAs(page, TEST_USERS.attorney.email, TEST_USERS.attorney.password);
    const res = await page.goto("/attorney/review/00000000-0000-0000-0000-000000000000");
    expect(res?.status()).toBeLessThan(500);
  });
});

test.describe("attorney API — auth guards", () => {
  test("POST /api/attorney/approve blocks unauthenticated", async ({ request }) => {
    const res = await request.post("/api/attorney/approve", {
      data: { reviewId: "fake", decision: "approved" },
    });
    expect([400, 401, 403, 307, 404]).toContain(res.status());
  });

  test("POST /api/attorney/review blocks unauthenticated", async ({ request }) => {
    const res = await request.post("/api/attorney/review", { data: {} });
    expect([400, 401, 403, 307, 404]).toContain(res.status());
  });
});
