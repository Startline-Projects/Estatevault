import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  authSetPasswordSchema,
  partnerClientsCreateSchema,
  salesPartnerNotesSchema,
} from "@/lib/validation/schemas";

/**
 * Phase 0 — Security Lockdown regression suite.
 *
 * Two kinds of assertion:
 *  1. BEHAVIOR — import the real Zod schemas and prove they accept good /
 *     reject bad input. If the schema regresses, these fail.
 *  2. SOURCE GUARD — read the real route/lib file and assert the fix is still
 *     present. Inline-copy tests pass even when the shipped code regresses;
 *     these read the actual source so a revert turns the suite red.
 *
 * Findings IDs map to PRODUCTION_PLAN.html / WHAT_HAS_BEEN_FIXED.md.
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
// S-07 — set-password account takeover: verified token required
// ---------------------------------------------------------------------------
describe("S-07 set-password token gate (real schema)", () => {
  it("rejects a payload with no verifiedToken", () => {
    const r = authSetPasswordSchema.safeParse({ email: "a@b.com", password: "longenough" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty verifiedToken", () => {
    const r = authSetPasswordSchema.safeParse({ email: "a@b.com", password: "longenough", verifiedToken: "" });
    expect(r.success).toBe(false);
  });

  it("rejects a short password (<8)", () => {
    const r = authSetPasswordSchema.safeParse({ email: "a@b.com", password: "short", verifiedToken: "tok_1" });
    expect(r.success).toBe(false);
  });

  it("does NOT accept a caller-supplied userId (stripped, not trusted)", () => {
    const r = authSetPasswordSchema.safeParse({
      email: "a@b.com",
      password: "longenough",
      verifiedToken: "tok_1",
      userId: "attacker-controlled",
    });
    expect(r.success).toBe(true);
    expect(r.success && "userId" in r.data).toBe(false);
  });

  it("accepts a well-formed payload", () => {
    const r = authSetPasswordSchema.safeParse({ email: "a@b.com", password: "longenough", verifiedToken: "tok_1" });
    expect(r.success).toBe(true);
  });

  it("source still consumes a one-time token before setting the password", () => {
    const code = src("app/api/auth/set-password/route.ts");
    expect(code).toMatch(/consumeVerifiedToken/);
  });
});

// ---------------------------------------------------------------------------
// S-05 / S-06 — body validation on the formerly-unguarded endpoints
// ---------------------------------------------------------------------------
describe("S-05 partner/clients body validation (real schema)", () => {
  it("requires partnerId", () => {
    const r = partnerClientsCreateSchema.safeParse({ firstName: "A", email: "a@b.com" });
    expect(r.success).toBe(false);
  });
  it("rejects empty partnerId", () => {
    const r = partnerClientsCreateSchema.safeParse({ firstName: "A", email: "a@b.com", partnerId: "" });
    expect(r.success).toBe(false);
  });
  it("accepts a valid create payload", () => {
    const r = partnerClientsCreateSchema.safeParse({ firstName: "A", email: "a@b.com", partnerId: "p1" });
    expect(r.success).toBe(true);
  });
  it("route enforces partner role + ownership", () => {
    const code = src("app/api/partner/clients/route.ts");
    expect(code).toMatch(/requireAuth\(\s*\[\s*"partner"/);
    expect(code).toMatch(/partnerId|partner_id/);
  });
});

describe("S-06 sales/partner-notes body validation (real schema)", () => {
  it("requires partnerId and note", () => {
    expect(salesPartnerNotesSchema.safeParse({}).success).toBe(false);
    expect(salesPartnerNotesSchema.safeParse({ partnerId: "p1" }).success).toBe(false);
    expect(salesPartnerNotesSchema.safeParse({ partnerId: "p1", note: "" }).success).toBe(false);
  });
  it("accepts a valid note payload", () => {
    expect(salesPartnerNotesSchema.safeParse({ partnerId: "p1", note: "hi" }).success).toBe(true);
  });
  it("route restricts to sales_rep / admin", () => {
    const code = src("app/api/sales/partner-notes/route.ts");
    expect(code).toMatch(/requireAuth\(\s*\[\s*"sales_rep"\s*,\s*"admin"/);
  });
});

// ---------------------------------------------------------------------------
// S-01 / S-03 — CRON_SECRET guard on destructive document endpoints
// ---------------------------------------------------------------------------
describe("S-01 / S-03 CRON_SECRET guards present", () => {
  it("S-01 documents/process reads CRON_SECRET", () => {
    expect(src("app/api/documents/process/route.ts")).toMatch(/CRON_SECRET/);
  });
  it("S-03 cleanup-test-orders reads CRON_SECRET", () => {
    expect(src("app/api/documents/cleanup-test-orders/route.ts")).toMatch(/CRON_SECRET/);
  });
});

// ---------------------------------------------------------------------------
// S-08 — hostname injection: sanitize before PostgREST .or() filter
// ---------------------------------------------------------------------------
describe("S-08 middleware hostname sanitization", () => {
  const code = src("lib/supabase/middleware.ts");

  it("strips non-host characters from the raw hostname", () => {
    expect(code).toMatch(/replace\(\/\[\^a-zA-Z0-9\.\\-\]\/g/);
  });

  it("does not wrap the hostname in quotes inside the .or() filter (no eq.\"...\")", () => {
    expect(code).not.toMatch(/eq\."\$\{/);
  });

  // Behavior of the sanitizer the source applies:
  it("sanitizer drops SQL/PostgREST injection characters", () => {
    const sanitize = (raw: string) => raw.replace(/[^a-zA-Z0-9.\-]/g, "");
    // ", comma and underscore are all stripped (underscore is not in the allowlist)
    expect(sanitize('evil.com",custom_domain.eq.evil')).toBe("evil.comcustomdomain.eq.evil");
    expect(sanitize('evil.com",custom_domain.eq.evil')).not.toContain('"');
    expect(sanitize('evil.com",custom_domain.eq.evil')).not.toContain(",");
    expect(sanitize("good-partner.estatevault.us")).toBe("good-partner.estatevault.us");
  });
});

// ---------------------------------------------------------------------------
// S-09 / M-14 — Stripe webhook idempotency + masked error
// ---------------------------------------------------------------------------
describe("S-09 / M-14 stripe webhook", () => {
  const code = src("app/api/webhooks/stripe/route.ts");
  it("S-09 checks idempotency and short-circuits duplicates", () => {
    expect(code).toMatch(/checkIdempotency/);
    expect(code).toMatch(/duplicate:\s*true/);
  });
  it("M-14 returns a generic signature error, not the raw message", () => {
    expect(code).toMatch(/signature verification failed/i);
    expect(code).not.toMatch(/Webhook Error:\s*\$\{/);
  });
});

// ---------------------------------------------------------------------------
// S-10 — DEK race: conditional UPDATE ... WHERE wrapped_dek IS NULL
// ---------------------------------------------------------------------------
describe("S-10 DEK conditional write (no TOCTOU)", () => {
  const code = src("lib/api/dek.ts");
  it("writes the DEK only when the column is still null", () => {
    expect(code).toMatch(/\.is\(\s*"wrapped_dek"\s*,\s*null\s*\)/);
  });

  // Behavior of the converge-on-first-writer pattern:
  it("loser of the race re-reads the winner's DEK (no overwrite)", () => {
    let stored: string | null = null;
    const write = (dek: string) => {
      if (stored === null) stored = dek;
      return stored;
    };
    expect([write("A"), write("B"), write("C")]).toEqual(["A", "A", "A"]);
  });
});

// ---------------------------------------------------------------------------
// H-01 — listUsers() memory bomb removed everywhere in app/api
// ---------------------------------------------------------------------------
describe("H-01 no listUsers() in API routes", () => {
  const files = [
    "app/api/webhooks/stripe/route.ts",
    // Stripe checkout account-provisioning was extracted out of the route into
    // these handlers (3.5) — the no-listUsers guard follows the code.
    "lib/webhooks/stripe/handleDocumentCheckout.ts",
    "lib/webhooks/stripe/resolveOrCreateGuestClient.ts",
    "app/api/checkout/will/route.ts",
    "app/api/checkout/trust/route.ts",
    "app/api/checkout/vault-subscription/route.ts",
    "app/api/partners/create-review-attorney/route.ts",
    "app/api/auth/set-password/route.ts",
  ];
  for (const f of files) {
    it(`${f} does not call listUsers()`, () => {
      expect(src(f)).not.toMatch(/listUsers\s*\(/);
    });
  }
  it("the webhook account-provisioning uses the targeted find_auth_user_by_email RPC", () => {
    expect(src("lib/webhooks/stripe/handleDocumentCheckout.ts")).toMatch(/find_auth_user_by_email/);
    expect(src("lib/webhooks/stripe/resolveOrCreateGuestClient.ts")).toMatch(/find_auth_user_by_email/);
  });
});

// ---------------------------------------------------------------------------
// H-02 — in-memory rate limiter deleted from lib/api/auth.ts
// ---------------------------------------------------------------------------
describe("H-02 in-memory rate limiter removed", () => {
  const code = src("lib/api/auth.ts");
  it("no rateBuckets Map remains", () => {
    expect(code).not.toMatch(/rateBuckets/);
  });
  it("no local rateLimit() function remains", () => {
    expect(code).not.toMatch(/function rateLimit\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// H-03 — cron routes fail CLOSED when CRON_SECRET is unset
// ---------------------------------------------------------------------------
describe("H-03 cron fail-closed", () => {
  const crons = [
    "app/api/cron/annual-review-reminder/route.ts",
    "app/api/cron/life-event-checkin/route.ts",
    "app/api/cron/farewell-window-expired/route.ts",
    "app/api/cron/farewell-veto-reminder/route.ts",
  ];
  for (const f of crons) {
    it(`${f} uses (!secret || ...) and never the fail-open (secret && ...)`, () => {
      const code = src(f);
      expect(code).toMatch(/if\s*\(\s*!secret\s*\|\|/);
      expect(code).not.toMatch(/if\s*\(\s*secret\s*&&/);
    });
  }

  // Behavior of the guard:
  it("guard denies when secret is unset", () => {
    const ok = (secret: string | undefined, hdr: string | undefined) => !(!secret || hdr !== `Bearer ${secret}`);
    expect(ok(undefined, "Bearer x")).toBe(false);
    expect(ok("", "Bearer ")).toBe(false);
    expect(ok("s", "Bearer s")).toBe(true);
    expect(ok("s", "Bearer wrong")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H-04 / H-05 — temp password: secure generation, not leaked in response
// ---------------------------------------------------------------------------
describe("H-04 / H-05 temp password handling", () => {
  it("H-05 create-partner uses crypto randomBytes, not Math.random", () => {
    const code = src("app/api/sales/create-partner/route.ts");
    expect(code).toMatch(/randomBytes/);
    expect(code).not.toMatch(/Math\.random/);
  });

  it("H-04 create-partner success response does not contain tempPassword", () => {
    const code = src("app/api/sales/create-partner/route.ts");
    const returns = code.match(/return ok\([^)]*\)/g) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const r of returns) expect(r).not.toMatch(/tempPassword/);
  });

  it("H-04 create-rep success response does not contain tempPassword", () => {
    const code = src("app/api/sales/create-rep/route.ts");
    const returns = code.match(/return ok\([^)]*\)/g) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const r of returns) expect(r).not.toMatch(/tempPassword/);
  });

  it("crypto.randomBytes yields unique, high-entropy values", () => {
    const crypto = require("crypto");
    const a = crypto.randomBytes(12).toString("base64url");
    const b = crypto.randomBytes(12).toString("base64url");
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// M-01 / M-02 — rate limiting on unauthenticated farewell endpoints
// ---------------------------------------------------------------------------
describe("M-01 / M-02 farewell rate limits", () => {
  it("M-01 farewell/verify is IP rate-limited", () => {
    const code = src("app/api/farewell/verify/route.ts");
    expect(code).toMatch(/RateLimit\.limit\(`farewell-verify:/);
  });
  it("M-02 farewell/access is IP rate-limited", () => {
    const code = src("app/api/farewell/access/route.ts");
    expect(code).toMatch(/RateLimit\.limit\(`farewell-access:/);
  });
});

// ---------------------------------------------------------------------------
// M-03 — download-by-session: order_id fallback restricted to test orders
// ---------------------------------------------------------------------------
describe("M-03 download-by-session IDOR fallback restricted", () => {
  const code = src("app/api/documents/download-by-session/route.ts");
  it("order_id fallback authorizes only test orders", () => {
    expect(code).toMatch(/order_type\s*===\s*"test"/);
  });
  it("paid orders still resolve through the Stripe session id", () => {
    expect(code).toMatch(/session_id|sessionId/);
  });
});

// ---------------------------------------------------------------------------
// M-04 — partner CSS XSS: accent color must be a 6-digit hex
// ---------------------------------------------------------------------------
describe("M-04 partner accent color hex validation", () => {
  const code = src("components/partner/PartnerThemedShell.tsx");
  it("validates accent color against a strict hex pattern", () => {
    expect(code).toMatch(/\/\^#\[0-9a-fA-F\]\{6\}\$\//);
  });
  it("falls back to brand gold on invalid input", () => {
    expect(code).toMatch(/#C9A84C/);
  });

  // Behavior of the validator:
  it("hex validator accepts brand colors, rejects injection", () => {
    const valid = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
    expect(valid("#1C3557")).toBe(true);
    expect(valid("#fff")).toBe(false);
    expect(valid("#C9A84C; background:url(evil)")).toBe(false);
    expect(valid("<script>")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// M-05 — partner-activated role check uses sales_rep, not "sales"
// ---------------------------------------------------------------------------
describe("M-05 partner-activated role string", () => {
  const code = src("app/api/email/partner-activated/route.ts");
  it("checks sales_rep, never the bare 'sales'", () => {
    expect(code).toMatch(/"sales_rep"/);
    expect(code).not.toMatch(/"sales"(?!_)/);
  });
});

// ---------------------------------------------------------------------------
// S-02 / S-04 — DESIGN NOTE: these two are intentionally public on this branch.
// They are post-payment endpoints hit by the success page before the customer
// has a session, so requireAuth() was removed in favor of bounded-abuse design.
// The tests below pin that CURRENT design so a silent change is caught. If the
// product decision is to re-gate them behind admin/CRON auth, update these.
// ---------------------------------------------------------------------------
describe("S-02 process-now is public but abuse-bounded (current design)", () => {
  const code = src("app/api/documents/process-now/route.ts");
  it("has no requireAuth gate (intentional — public success-page trigger)", () => {
    expect(code).not.toMatch(/requireAuth/);
  });
  it("documents the bounded-abuse rationale in a comment", () => {
    expect(code).toMatch(/publicPaths|bounded|already-finished|short-circuit/i);
  });
});

describe("S-04 check-status is a minimal public poll (current design)", () => {
  const code = src("app/api/documents/check-status/route.ts");
  it("returns only non-sensitive document metadata (has_file boolean, no signed URL)", () => {
    // The mapped response exposes a has_file boolean instead of the raw
    // storage_path/signed URL — that minimization is the S-04 mitigation.
    expect(code).toMatch(/has_file:\s*!!d\.storage_path/);
    expect(code).not.toMatch(/createSignedUrl|signedUrl|getPublicUrl/);
  });
});
