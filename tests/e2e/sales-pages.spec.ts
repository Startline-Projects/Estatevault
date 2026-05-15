import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { TEST_USERS } from "../fixtures/users";

/**
 * Sales-rep portal smoke. Sales accounts log in on the sales host, so this
 * whole file runs under the `sales` Playwright project.
 */

const SALES_ROUTES = [
  "/pro/sales",
  "/pro/sales/partners",
  "/pro/sales/pipeline",
  "/pro/sales/new-partner",
  "/pro/sales/commission",
  "/pro/sales/account",
];

test.describe("sales portal — smoke", { tag: "@sales" }, () => {
  for (const route of SALES_ROUTES) {
    test(`${route} loads for authenticated sales rep`, async ({ page }) => {
      await loginAs(page, TEST_USERS.salesRep.email, TEST_USERS.salesRep.password);
      const res = await page.goto(route);
      expect(res?.status()).toBeLessThan(500);
      await expect(page).not.toHaveURL(/\/auth\/login/);
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});

test.describe("sales API — auth guards", () => {
  test("GET /api/sales/reps blocks unauthenticated", async ({ request }) => {
    const res = await request.get("/api/sales/reps");
    expect([401, 403, 307]).toContain(res.status());
  });

  test("POST /api/sales/create-partner blocks unauthenticated", async ({ request }) => {
    const res = await request.post("/api/sales/create-partner", {
      data: { companyName: "X", ownerName: "Y", email: "z@z.test" },
    });
    expect([400, 401, 403, 307]).toContain(res.status());
  });

  test("POST /api/sales/create-rep blocks unauthenticated", async ({ request }) => {
    const res = await request.post("/api/sales/create-rep", { data: {} });
    expect([400, 401, 403, 307]).toContain(res.status());
  });
});
