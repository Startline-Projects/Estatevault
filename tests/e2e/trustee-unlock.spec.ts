import { test, expect } from "@playwright/test";

test.describe("trustee unlock + vault decrypt", () => {
  test.fixme("trustee requests OTP — email sent", async ({ page }) => {
    // TODO: POST /api/trustee/request-otp, assert Resend mock invoked
  });

  test.fixme("valid OTP unlocks vault — items decrypt client-side", async ({ page }) => {
    // TODO: submit OTP, navigate to trustee vault, assert decrypted item visible
  });

  test.fixme("expired OTP rejected", async ({ page }) => {
    // TODO
  });

  test.fixme("invalid OTP rejected — rate limit after N tries", async ({ page }) => {
    // TODO
  });

  test.fixme("farewell video plays after unlock", async ({ page }) => {
    // TODO: assert <video> source resolves, play event fires
  });
});
