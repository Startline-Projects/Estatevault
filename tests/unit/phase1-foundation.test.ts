import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { b64encode, b64decode } from "@/lib/crypto/encoding";

/**
 * Phase 1 — Foundation Hardening regression suite.
 *
 * Findings: H-06 (fail-fast secrets), H-07 (single Stripe client),
 * M-12 (image allowlist), M-13 (webhook maxDuration), L-06 (encoding DRY).
 *
 * encoding roundtrips (16 tests) live in encoding.test.ts and validateEnv
 * behavior (5) in env-validation.test.ts — not duplicated here. This file
 * pins the source-level fixes those suites can't see.
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
// H-06 — no hardcoded placeholder secrets; lazy init; startup validation
// ---------------------------------------------------------------------------
describe("H-06 fail-fast on missing secrets", () => {
  it("lib/stripe.ts has no placeholder fallback and lazy-inits via Proxy", () => {
    const code = src("lib/stripe.ts");
    expect(code).not.toMatch(/sk_test_placeholder|"placeholder"/);
    expect(code).toMatch(/new Proxy/);
    expect(code).toMatch(/STRIPE_SECRET_KEY!/);
  });

  it("lib/claude.ts has no placeholder fallback", () => {
    expect(src("lib/claude.ts")).not.toMatch(/\|\|\s*"placeholder"/);
  });

  it("lib/email.ts has no placeholder fallback", () => {
    expect(src("lib/email.ts")).not.toMatch(/re_placeholder/);
  });

  it("instrumentation.ts runs validateEnv() at startup", () => {
    const code = src("instrumentation.ts");
    expect(code).toMatch(/import\s*\{\s*validateEnv\s*\}/);
    expect(code).toMatch(/export function register\(\)/);
    expect(code).toMatch(/validateEnv\(\)/);
  });

  it("env.ts lists every required secret and throws only in production", () => {
    const code = src("lib/env.ts");
    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "ANTHROPIC_API_KEY",
      "RESEND_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(code).toMatch(new RegExp(key));
    }
    expect(code).toMatch(/NODE_ENV === 'production'/);
    expect(code).toMatch(/throw new Error/);
  });
});

// ---------------------------------------------------------------------------
// H-07 — one Stripe client, one API version, no `as any`
// ---------------------------------------------------------------------------
describe("H-07 unified Stripe client", () => {
  it("stripe-payouts imports the shared client instead of constructing its own", () => {
    const code = src("lib/stripe-payouts.ts");
    expect(code).toMatch(/import\s*\{\s*stripe\s*\}\s*from\s*['"]\.\/stripe['"]/);
    expect(code).not.toMatch(/new Stripe\(/);
    expect(code).not.toMatch(/as any/);
  });

  it("the single client pins one API version", () => {
    const code = src("lib/stripe.ts");
    const versions = code.match(/apiVersion:\s*["'][^"']+["']/g) ?? [];
    expect(versions.length).toBe(1);
    expect(versions[0]).toMatch(/2026-03-25\.dahlia/);
  });
});

// ---------------------------------------------------------------------------
// M-12 — image optimization allowlist no longer wide open
// ---------------------------------------------------------------------------
describe("M-12 next/image remotePatterns allowlist", () => {
  const code = src("next.config.mjs");
  it("does not contain the catch-all hostname wildcard", () => {
    expect(code).not.toMatch(/hostname:\s*['"]\*\*['"]/);
  });
  it("allows the supabase storage host explicitly", () => {
    expect(code).toMatch(/\*\.supabase\.co/);
  });
});

// ---------------------------------------------------------------------------
// M-13 — webhook handler gets a long maxDuration in vercel.json
// ---------------------------------------------------------------------------
describe("M-13 webhook maxDuration", () => {
  it("vercel.json sets maxDuration 300 for the stripe webhook route", () => {
    const cfg = JSON.parse(src("vercel.json"));
    const fns = cfg.functions ?? {};
    const webhook = fns["app/api/webhooks/stripe/route.ts"];
    expect(webhook).toBeDefined();
    expect(webhook.maxDuration).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// L-06 — encoding helpers consolidated; importers use the shared module
// ---------------------------------------------------------------------------
describe("L-06 encoding DRY", () => {
  it("real b64 roundtrip via the shared module", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(Array.from(b64decode(b64encode(bytes)))).toEqual(Array.from(bytes));
  });

  const importers = [
    "lib/repos/videoRepo.ts",
    "lib/repos/cryptoRepo.ts",
    "lib/repos/shareRepo.ts",
    "lib/repos/backfillRepo.ts",
    "lib/api/crypto.ts",
  ];
  for (const f of importers) {
    it(`${f} imports from the shared encoding module`, () => {
      expect(src(f)).toMatch(/crypto\/encoding/);
    });
    it(`${f} does not redeclare a local b64 helper`, () => {
      // a local definition would look like `function b64(` / `const b64 =`
      expect(src(f)).not.toMatch(/(function|const)\s+b64encode\b/);
    });
  }
});
