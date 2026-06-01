import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createCheckoutSession } from "@/lib/checkout/createCheckoutSession";

/**
 * Phase 2 — Structural Refactor regression suite.
 *
 * Findings: H-08 (no inline createAdminClient), H-09 (withRoute everywhere),
 * H-10 (checkout dedup), L-02 (dead import).
 *
 * H-08 and H-10 are fully shipped and asserted strictly. H-09 and L-02 are
 * NOT fully shipped on this branch — they are pinned to current reality so the
 * gap is visible and any drift (good or bad) trips the test. See KNOWN GAPS.
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRoutes(rel));
    else if (entry.name === "route.ts") out.push(rel);
  }
  return out.map((p) => relative(ROOT, join(ROOT, p)).split("\\").join("/"));
}

const ROUTES = walkRoutes("app/api").sort();

// ---------------------------------------------------------------------------
// H-08 — createAdminClient is never re-declared inside a route (import only)
// ---------------------------------------------------------------------------
describe("H-08 no inline createAdminClient definitions", () => {
  it("scans every route; none defines createAdminClient locally", () => {
    const offenders = ROUTES.filter((f) =>
      /(function|const)\s+createAdminClient\b/.test(src(f))
    );
    expect(offenders).toEqual([]);
  });

  it("found a non-trivial number of route files to scan", () => {
    expect(ROUTES.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// H-09 — withRoute coverage. KNOWN GAP: 20 routes are still unwrapped.
//   6 legitimately return non-JSON (HTML / PDF / 204) and never should wrap.
//   14 are JSON routes not yet folded into a Phase 2 group.
// Snapshot pins the current set: wrapping one (good) or adding a new unwrapped
// route (bad) both fail this test, forcing a conscious update.
// ---------------------------------------------------------------------------
describe("H-09 withRoute coverage (pinned — partial)", () => {
  // intentionally not wrapped: emit HTML / PDF / empty 204, not the JSON envelope
  const NON_JSON_OUTPUT = [
    "app/api/auth/verify-link/route.ts",
    "app/api/csp-report/route.ts",
    "app/api/marketing/flyer/route.ts",
    "app/api/marketing/materials/route.ts",
    "app/api/marketing/one-pager/route.ts",
    "app/api/marketing/script-card/route.ts",
  ];
  // JSON routes still awaiting migration onto the kernel
  const NOT_YET_MIGRATED = [
    "app/api/affiliate/onboarding/callback/route.ts",
    "app/api/affiliate/onboarding/route.ts",
    "app/api/affiliate/signup/route.ts",
    "app/api/client/mark-executed/route.ts",
    "app/api/contact/route.ts",
    "app/api/email/partner-activated/route.ts",
    "app/api/professionals/request-access/route.ts",
    "app/api/quiz/personalize/route.ts",
    "app/api/share/route.ts",
    "app/api/stripe/connect/onboard/route.ts",
    "app/api/stripe/connect/status/route.ts",
    "app/api/subscription/cancel/route.ts",
    "app/api/subscription/status/route.ts",
    "app/api/subscription/sync/route.ts",
  ];

  const unwrapped = ROUTES.filter((f) => !/withRoute/.test(src(f))).sort();

  it("unwrapped set matches the known snapshot (update when migrating a route)", () => {
    expect(unwrapped).toEqual([...NON_JSON_OUTPUT, ...NOT_YET_MIGRATED].sort());
  });

  it("the vast majority of routes ARE wrapped", () => {
    const wrapped = ROUTES.length - unwrapped.length;
    expect(wrapped).toBeGreaterThanOrEqual(100);
  });

  it("core security/document groups are fully wrapped", () => {
    const mustWrap = ROUTES.filter(
      (f) =>
        f.startsWith("app/api/cron/") ||
        f.startsWith("app/api/documents/") ||
        f.startsWith("app/api/attorney/") ||
        f.startsWith("app/api/crypto/") ||
        f.startsWith("app/api/trustee/")
    );
    const missing = mustWrap.filter((f) => !/withRoute/.test(src(f)));
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// H-10 — will/trust checkout collapsed onto a shared module
// ---------------------------------------------------------------------------
describe("H-10 checkout dedup", () => {
  it("the shared createCheckoutSession is a real exported function", () => {
    expect(typeof createCheckoutSession).toBe("function");
  });

  for (const variant of ["will", "trust"]) {
    it(`checkout/${variant} is a thin wrapper over the shared session`, () => {
      const code = src(`app/api/checkout/${variant}/route.ts`);
      expect(code).toMatch(/createCheckoutSession/);
      expect(code).toMatch(/withRoute/);
      // thin: well under the old ~400-line monoliths
      expect(code.split("\n").length).toBeLessThan(60);
    });
  }
});

// ---------------------------------------------------------------------------
// L-02 — KNOWN GAP: dead validateEnvelope import not yet removed.
// Pinned to current reality. When the import + `void validateEnvelope;` are
// removed, flip these two expectations.
// ---------------------------------------------------------------------------
describe("L-02 dead import in share/route.ts (pinned — NOT yet done)", () => {
  const code = src("app/api/share/route.ts");
  it("still imports validateEnvelope (open nit)", () => {
    expect(code).toMatch(/validateEnvelope/);
  });
  it("still carries the void suppression for it (open nit)", () => {
    expect(code).toMatch(/void validateEnvelope/);
  });
});
