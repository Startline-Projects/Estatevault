import { test, expect } from "@playwright/test";

test.describe("@pro marketing PDF generation", () => {
  test.fixme("partner generates co-branded PDF — downloads", async ({ page }) => {
    // TODO: /pro/marketing, click generate, assert download event + valid PDF magic bytes
  });

  test.fixme("PDF includes partner logo + theme color", async ({ page }) => {
    // TODO: parse PDF or assert request payload
  });

  test.fixme("PDF generation gated to active partners only", async ({ page }) => {
    // TODO: inactive partner → 403
  });

  test.fixme("rate limit — N PDFs per partner per day", async ({ page }) => {
    // TODO
  });
});
