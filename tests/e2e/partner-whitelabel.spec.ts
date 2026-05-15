import { test, expect } from "@playwright/test";

test.describe("partner white-label", () => {
  test.fixme("/[partner-slug] renders partner brand + logo", async ({ page }) => {
    // TODO
  });

  test.fixme("/[partner-slug] theme color applied to CTA", async ({ page }) => {
    // TODO: read computed background-color, assert matches partners.theme_color
  });

  test.fixme("/[partner-slug]/vault renders with partner theme", async ({ page }) => {
    // TODO
  });

  test.fixme("invalid slug → 404", async ({ page }) => {
    // TODO
  });

  test.fixme("quiz started under partner slug — attribution recorded", async ({ page }) => {
    // TODO: complete quiz, assert lead.partner_id set
  });

  test.fixme("checkout under partner slug — revenue split applied", async ({ page }) => {
    // TODO: standard $300/will, enterprise $350/will (Core Rule 6)
  });
});
