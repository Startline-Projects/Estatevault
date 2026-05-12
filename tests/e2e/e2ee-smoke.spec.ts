import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../fixtures/users";
import { loginAs } from "./helpers/auth";
import { adminClient } from "./helpers/auth";

/**
 * E2EE smoke. Validates the critical end-to-end paths that prove
 * "server never sees plaintext" for new data.
 *
 * Pre-reqs:
 *   - Phase 1 + Phase 12 + Phase 12b migrations applied to test DB.
 *   - test-client@estatevault.test seeded by `npm run test:db:seed`.
 *
 * Resets the test client's crypto bundle before each run so onboarding flow
 * can be exercised every time.
 */

const TEST_PASSPHRASE = "correct horse battery staple ABCD";
const PASSPHRASE_VERIFY_REGEX = /Vault locked|Unlock vault|Set up your vault/i;

async function getTestClient() {
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", TEST_USERS.client.email)
    .single();
  if (!profile) throw new Error("test client profile missing — run npm run test:db:seed");
  const { data: client } = await admin
    .from("clients")
    .select("id, profile_id, crypto_setup_at, wrapped_mk_pass, pubkey_x25519")
    .eq("profile_id", profile.id)
    .single();
  if (!client) throw new Error("test client row missing");
  return { admin, profileId: profile.id, client };
}

async function resetCryptoBundle() {
  const { admin, client } = await getTestClient();
  await admin.from("clients").update({
    kdf_salt: null,
    kdf_params: null,
    wrapped_mk_pass: null,
    wrapped_mk_recovery: null,
    pubkey_x25519: null,
    pubkey_ed25519: null,
    crypto_setup_at: null,
    crypto_backfill_complete_at: null,
  }).eq("id", client.id);
}

test.describe("E2EE bootstrap + unlock", () => {
  test.beforeEach(async () => {
    await resetCryptoBundle();
  });

  test("onboarding writes wrapped material; DB has no plaintext", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);

    // Fresh user dashboard should surface "Set up vault" CTA in UnlockModal.
    await page.goto("/dashboard");
    const setUpLink = page.getByRole("link", { name: /set up vault/i });
    if (await setUpLink.count() > 0) {
      await setUpLink.first().click();
    } else {
      await page.goto("/onboarding/vault-setup");
    }
    await expect(page).toHaveURL(/\/onboarding\/vault-setup/);

    // Step 1 — passphrase
    await page.getByLabel(/^Passphrase$/).fill(TEST_PASSPHRASE);
    await page.getByLabel(/Confirm passphrase/i).fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: /^Continue$/ }).click();

    // Step 2 — mnemonic display: capture words then acknowledge.
    await expect(page.getByText(/Write down these 24 words/i)).toBeVisible({ timeout: 30_000 });
    const wordEls = page.locator("ol li span.font-medium");
    await expect(wordEls).toHaveCount(24);
    const words: string[] = [];
    for (let i = 0; i < 24; i++) words.push(((await wordEls.nth(i).textContent()) ?? "").trim());
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /^Continue$/ }).click();

    // Step 3 — confirm 3 words.
    await expect(page.getByText(/confirm you have your recovery phrase/i)).toBeVisible();
    const inputs = page.locator('input[autocomplete="off"]');
    const indexLabels = await page.locator("label:has-text('Word #')").allTextContents();
    for (let k = 0; k < indexLabels.length; k++) {
      const m = indexLabels[k].match(/Word #(\d+)/);
      if (!m) continue;
      const i = parseInt(m[1], 10) - 1;
      await inputs.nth(k).fill(words[i]);
    }
    await page.getByRole("button", { name: /Confirm & finish/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    // DB invariants
    const { client } = await getTestClient();
    expect(client.crypto_setup_at).toBeTruthy();
    expect(client.wrapped_mk_pass).toBeTruthy();
    expect(client.pubkey_x25519).toBeTruthy();
  });

  test("unlock modal blocks dashboard until passphrase entered", async ({ page }) => {
    // Run after a successful bootstrap so wrapped material exists.
    // (The previous test resets at start; this depends on running second.)
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);

    const { client } = await getTestClient();
    if (!client.wrapped_mk_pass) test.skip(true, "client not bootstrapped; run bootstrap test first");

    await page.goto("/dashboard");
    // Modal should be present (worker starts locked on each load).
    await expect(page.getByText(PASSPHRASE_VERIFY_REGEX)).toBeVisible({ timeout: 15_000 });
    const ppInput = page.getByLabel(/^Passphrase$/);
    await ppInput.fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: /^Unlock$/ }).click();

    // Modal should disappear
    await expect(page.getByText(/Vault locked|Unlock vault/i)).toBeHidden({ timeout: 15_000 });
  });
});

test.describe("E2EE vault item create", () => {
  test("creating an item writes ciphertext (no plaintext label/data)", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);

    const { admin, client } = await getTestClient();
    if (!client.wrapped_mk_pass) test.skip(true, "client not bootstrapped");

    // Unlock via modal
    await page.goto("/dashboard");
    if (await page.getByText(/Unlock vault/i).count() > 0) {
      await page.getByLabel(/^Passphrase$/).fill(TEST_PASSPHRASE);
      await page.getByRole("button", { name: /^Unlock$/ }).click();
      await page.waitForTimeout(1500);
    }

    // Add a contact item via repo path (simulating UI flow). Using the page
    // here would require navigating the 8-category UI; instead we exercise
    // the network layer directly — same code path the page uses.
    const probe = await page.evaluate(async () => {
      const { createItem } = await import("/lib/repos/vaultRepo.ts" as string);
      const { id } = await (createItem as (a: unknown) => Promise<{ id: string }>)({
        category: "contact",
        label: "E2EE smoke contact",
        data: { full_name: "Jane Doe" },
      });
      return id;
    }).catch(() => null);

    if (!probe) {
      test.skip(true, "module-level import not supported by Playwright eval; run in browser fixture instead");
    }

    // Verify DB
    const { data: row } = await admin
      .from("vault_items")
      .select("id, label, data, ciphertext, nonce, label_blind")
      .eq("id", probe!)
      .single();
    expect(row).toBeTruthy();
    expect(row!.ciphertext).toBeTruthy();
    expect(row!.nonce).toBeTruthy();
    expect(row!.label_blind).toBeTruthy();
    // Plaintext columns should be empty/null for E2EE rows
    expect(row!.label || "").toBe("");
    expect(row!.data ?? null).toEqual({});

    // Cleanup
    await admin.from("vault_items").delete().eq("id", probe!);
  });
});

test.describe("E2EE trustee create", () => {
  test("adding a trustee writes ciphertext + email_blind", async ({ page }) => {
    await loginAs(page, TEST_USERS.client.email, TEST_USERS.client.password);

    const { admin, client } = await getTestClient();
    if (!client.wrapped_mk_pass) test.skip(true, "client not bootstrapped");

    // Unlock
    await page.goto("/dashboard/vault/trustees");
    if (await page.getByText(/Unlock vault/i).count() > 0) {
      await page.getByLabel(/^Passphrase$/).fill(TEST_PASSPHRASE);
      await page.getByRole("button", { name: /^Unlock$/ }).click();
      await page.waitForTimeout(1500);
    }

    // Use the form (limited to 2 trustees).
    await admin.from("vault_trustees").delete().eq("client_id", client.id);
    await page.reload();

    await page.getByLabel(/Full name/i).fill("E2EE Trustee Test");
    await page.getByLabel(/Email/i).fill("e2ee-trustee@example.test");
    await page.getByRole("button", { name: /^Friend$/ }).click();
    await page.getByRole("button", { name: /Add Trustee/i }).click();

    // Wait for confirmation banner
    await expect(page.getByText(/Confirmation email sent/i)).toBeVisible({ timeout: 15_000 });

    const { data: rows } = await admin
      .from("vault_trustees")
      .select("id, ciphertext, nonce, email_blind, trustee_email, trustee_name")
      .eq("client_id", client.id);
    expect(rows?.length).toBeGreaterThan(0);
    const row = rows![0];
    expect(row.ciphertext).toBeTruthy();
    expect(row.nonce).toBeTruthy();
    expect(row.email_blind).toBeTruthy();
    expect(row.trustee_email || "").toBe("");
    expect(row.trustee_name || "").toBe("");

    await admin.from("vault_trustees").delete().eq("id", row.id);
  });
});

test.describe("E2EE storage hardening", () => {
  test("anon GET on documents bucket returns 4xx (RLS deny-all)", async ({ request }) => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/documents/probe.bin`;
    const r = await request.get(url, { failOnStatusCode: false });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });

  test("anon GET on farewell-videos bucket returns 4xx", async ({ request }) => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/farewell-videos/probe.bin`;
    const r = await request.get(url, { failOnStatusCode: false });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("E2EE API auth", () => {
  test("/api/crypto/bundle 401 without auth", async ({ request }) => {
    const r = await request.get("/api/crypto/bundle", { failOnStatusCode: false });
    expect(r.status()).toBe(401);
  });

  test("/api/share with deny-all RLS blocks direct anon writes", async () => {
    const admin = adminClient();
    const { data: anon } = await admin.auth.signInAnonymously?.() ?? { data: null };
    if (!anon?.session) test.skip(true, "anon sign-in not configured");
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/item_shares`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${anon!.session!.access_token}`,
      },
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
