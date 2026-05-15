import { test, expect } from "@playwright/test";

test.describe("E2EE — passphrase + recovery + Shamir", () => {
  test.fixme("rotate passphrase — old phrase fails, new phrase decrypts", async ({ page }) => {
    // TODO
  });

  test.fixme("rotate passphrase — existing vault items still decrypt", async ({ page }) => {
    // TODO: assert wrapped DEK re-wrapped, items readable
  });

  test.fixme("recovery code unlocks vault when passphrase forgotten", async ({ page }) => {
    // TODO
  });

  test.fixme("recovery code single-use — second attempt fails", async ({ page }) => {
    // TODO
  });

  test.fixme("Shamir setup — split key into N shares, threshold T", async ({ page }) => {
    // TODO
  });

  test.fixme("Shamir recover — T shares reconstruct, T-1 fails", async ({ page }) => {
    // TODO
  });

  test.fixme("ciphertext at rest — DB has no plaintext (regression)", async ({ page }) => {
    // TODO: mirrors e2ee-smoke pattern
  });
});
