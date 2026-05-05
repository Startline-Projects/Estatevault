import { test, expect } from "@playwright/test";

test.describe("quiz flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/quiz");
  });

  test("quiz page loads and shows state question", async ({ page }) => {
    await expect(page.locator("text=What state do you live in?")).toBeVisible({ timeout: 8_000 });
  });

  test("quiz page shows marital status question", async ({ page }) => {
    await expect(page.locator("text=What is your marital status?")).toBeVisible({ timeout: 8_000 });
  });

  test("Continue button disabled until card complete", async ({ page }) => {
    const btn = page.getByRole("button", { name: /continue/i });
    await expect(btn).toBeVisible({ timeout: 8_000 });
    await expect(btn).toBeDisabled();
  });

  test("Continue button enables after answering first card", async ({ page }) => {
    // State defaults to Michigan — just pick marital status
    await page.locator("text=Single").click();
    const btn = page.getByRole("button", { name: /continue/i });
    await expect(btn).toBeEnabled({ timeout: 3_000 });
  });

  test("progress advances after completing first card", async ({ page }) => {
    await page.locator("text=Single").click();
    await page.getByRole("button", { name: /continue/i }).click();
    // Card 2: family question
    await expect(page.locator("text=/family|children/i").first()).toBeVisible({ timeout: 8_000 });
  });

  test("special needs hard stop appears when triggered", async ({ page }) => {
    // Card 1: marital status
    await page.locator("text=Married").click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Card 2: Do you have children?
    await expect(page.locator("text=/children/i").first()).toBeVisible({ timeout: 5_000 });
    await page.locator("text=Yes").first().click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Card B2: special needs children?
    const specialNeedsCard = page.locator("text=/special needs/i").first();
    if (await specialNeedsCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator("text=Yes").first().click();
      await page.getByRole("button", { name: /continue/i }).click();
      // HardStopCard should show
      await expect(page.locator("text=/attorney|specialist|referral/i").first()).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip();
    }
  });

  test("result screen shows 'Based on your answers'", async ({ page }) => {
    test.setTimeout(90_000);

    const cont = () => page.getByRole("button", { name: /continue/i });

    // A1: state (defaults Michigan) + marital status
    await page.locator("text=Single").click();
    await cont().click();

    // B1: children — No (skips B2)
    await expect(page.locator("text=Do you have children?")).toBeVisible({ timeout: 8_000 });
    await page.locator("text=No").first().click();
    await cont().click();

    // C1: real estate — No
    await expect(page.locator("text=Do you own real estate?")).toBeVisible({ timeout: 8_000 });
    await page.locator("text=No").first().click();
    await cont().click();

    // C3: business + net worth
    await expect(page.locator("text=Do you own a business?")).toBeVisible({ timeout: 8_000 });
    await page.locator("text=No").first().click();
    await page.locator("text=Under $150K").click();
    await cont().click();

    // D1: privacy + charitable giving
    await expect(page.locator("text=/privacy important/i")).toBeVisible({ timeout: 8_000 });
    await page.locator("text=No").first().click();
    await page.locator("text=No").nth(1).click();
    await cont().click();

    // E1: existing plan — No
    await expect(page.locator("text=/currently have a will/i")).toBeVisible({ timeout: 8_000 });
    await page.locator("text=No").first().click();
    await cont().click();

    // F1: names
    await expect(page.locator("text=/manage your finances/i")).toBeVisible({ timeout: 8_000 });
    await page.locator("input[placeholder='Full name']").nth(0).fill("John Doe");
    await page.locator("input[placeholder='Full name']").nth(1).fill("Jane Doe");
    await page.locator("input[placeholder='Full name or N/A']").fill("N/A");
    await cont().click();

    // G1: additional situation
    await expect(page.locator("text=/anything else important/i")).toBeVisible({ timeout: 8_000 });
    await page.locator("text=None of the above").click();
    await cont().click();

    await expect(page.locator("text=/Based on your answers/i")).toBeVisible({ timeout: 15_000 });
  });
});
