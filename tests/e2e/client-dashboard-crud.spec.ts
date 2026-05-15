import { test, expect } from "@playwright/test";

test.describe("client dashboard CRUD", () => {
  test.fixme("amendment — create, charges $50, generates new doc", async ({ page }) => {
    // TODO: Core Rule 5 — amendment $50
  });

  test.fixme("life-events — add event, persists across reload", async ({ page }) => {
    // TODO
  });

  test.fixme("life-events — edit + delete", async ({ page }) => {
    // TODO
  });

  test.fixme("vault items — create text item, encrypted at rest", async ({ page }) => {
    // TODO: read row via service client, assert ciphertext != plaintext
  });

  test.fixme("vault items — file upload + download round-trip", async ({ page }) => {
    // TODO
  });

  test.fixme("vault items — delete removes storage object + DB row", async ({ page }) => {
    // TODO
  });

  test.fixme("funding-checklist — toggle items, progress persists", async ({ page }) => {
    // TODO
  });

  test.fixme("settings — update profile, change vault PIN", async ({ page }) => {
    // TODO
  });
});
