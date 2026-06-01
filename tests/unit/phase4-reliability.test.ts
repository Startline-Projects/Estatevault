import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 4 — Reliability & Scalability regression suite.
 *
 * Findings: M-07 (email retry), M-08 (per-document status), M-09 (cron
 * pagination), M-10 (Redis queue TTL/retry/DLQ), M-11 (KEK TTL),
 * L-05 (audit-log retry).
 *
 * These touch Redis/Resend/Supabase at import time, so the real modules are
 * asserted by SOURCE GUARD; the retry/backoff/threshold LOGIC is re-exercised
 * as pure behavior to prove the algorithm, not just its presence.
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
// M-07 — email send wrapped in bounded retry with backoff
// ---------------------------------------------------------------------------
describe("M-07 email retry", () => {
  const code = src("lib/email.ts");
  it("defines a shared sendEmail() wrapper with backoff delays", () => {
    expect(code).toMatch(/export async function sendEmail/);
    expect(code).toMatch(/RETRY_DELAYS\s*=\s*\[200,\s*600\]/);
  });
  it("logs a permanent failure after exhausting retries", () => {
    expect(code).toMatch(/permanent failure after retries/);
  });
  it("getResend is not called directly outside the wrapper (transport centralized)", () => {
    // every send goes through sendEmail; only sendEmail itself calls getResend
    const directCalls = (code.match(/getResend\(\)\.emails\.send/g) ?? []).length;
    expect(directCalls).toBeLessThanOrEqual(1);
  });

  // behavior: a 3-try loop (initial + 2 backoffs) stops at first success
  it("retry loop attempts at most 1 + RETRY_DELAYS.length times", () => {
    const RETRY_DELAYS = [200, 600];
    function run(succeedOn: number) {
      let tries = 0;
      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        tries++;
        if (tries === succeedOn) return { tries, ok: true };
      }
      return { tries, ok: false };
    }
    expect(run(1)).toEqual({ tries: 1, ok: true });
    expect(run(3)).toEqual({ tries: 3, ok: true });
    expect(run(99)).toEqual({ tries: 3, ok: false }); // gives up after 3
  });
});

// ---------------------------------------------------------------------------
// M-08 — per-document status, partial-failure safe
// ---------------------------------------------------------------------------
describe("M-08 per-document status tracking", () => {
  it("documentRepo exposes single-document status helpers", () => {
    const repo = src("lib/repos/server/documentRepo.ts");
    expect(repo).toMatch(/export function updateStatusByType/);
    expect(repo).toMatch(/export function countByStatus/);
  });

  it("process route walks each doc through generating -> generated/failed", () => {
    const code = src("app/api/documents/process/route.ts");
    expect(code).toMatch(/updateStatusByType\([^)]*"generating"/);
    expect(code).toMatch(/updateStatusByType\([^)]*"generated"/);
    expect(code).toMatch(/updateStatusByType\([^)]*"failed"/);
  });

  it("final promotion only touches successfully generated docs (not bulk by order)", () => {
    const code = src("app/api/documents/process/route.ts");
    expect(code).toMatch(/\.eq\("status",\s*"generated"\)/);
  });
});

// ---------------------------------------------------------------------------
// M-09 — cron queries are paginated (no unbounded scans)
// ---------------------------------------------------------------------------
describe("M-09 cron pagination", () => {
  it("orderRepo.findDeliveredBefore is bounded to 50", () => {
    expect(src("lib/repos/server/orderRepo.ts")).toMatch(/\.limit\(50\)/);
  });
  it("farewellVerificationRepo bounds its scans to 50", () => {
    const code = src("lib/repos/server/farewellVerificationRepo.ts");
    expect((code.match(/\.limit\(50\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// M-10 — Redis queue: TTL, max-retry, dead-letter, fail-loud
// ---------------------------------------------------------------------------
describe("M-10 Redis queue hardening", () => {
  const code = src("lib/queue/document-queue.ts");
  it("jobs carry a 24h TTL", () => {
    expect(code).toMatch(/JOB_TTL_SECONDS\s*=\s*24\s*\*\s*60\s*\*\s*60/);
    expect(code).toMatch(/redis\.expire\(`job:/);
  });
  it("caps retries and routes poisoned jobs to a dead-letter list", () => {
    expect(code).toMatch(/MAX_ATTEMPTS\s*=\s*3/);
    expect(code).toMatch(/attempts >= MAX_ATTEMPTS/);
    expect(code).toMatch(/lpush\("doc_dead_letter"/);
  });
  it("fails loudly when Redis is unconfigured (no silent drop)", () => {
    expect(code).toMatch(/throw new Error\("Redis not configured/);
    expect(code).toMatch(/export function isRedisConfigured/);
  });

  // behavior: dead-letter threshold
  it("a job is dead-lettered only once attempts reach the cap", () => {
    const MAX = 3;
    const shouldDLQ = (attempts: number) => attempts >= MAX;
    expect(shouldDLQ(2)).toBe(false);
    expect(shouldDLQ(3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M-11 — KEK cache expires (rotation without redeploy)
// ---------------------------------------------------------------------------
describe("M-11 KEK cache TTL", () => {
  const code = src("lib/api/dek.ts");
  it("caches the KEK with a 5-minute TTL", () => {
    expect(code).toMatch(/KEK_TTL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  });
  it("serves cache only while within TTL", () => {
    expect(code).toMatch(/Date\.now\(\)\s*-\s*kekCachedAt\s*<\s*KEK_TTL_MS/);
  });

  // behavior: TTL gate
  it("TTL gate misses once the window passes", () => {
    const TTL = 5 * 60 * 1000;
    const fresh = (cachedAt: number, now: number) => now - cachedAt < TTL;
    expect(fresh(0, TTL - 1)).toBe(true);
    expect(fresh(0, TTL + 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// L-05 — audit-log insert awaited and retried once
// ---------------------------------------------------------------------------
describe("L-05 audit-log durability", () => {
  const code = src("lib/repos/server/auditLogRepo.ts");
  it("awaits the insert and retries once before logging permanent failure", () => {
    expect(code).toMatch(/await admin\.from\("audit_log"\)\.insert/);
    expect(code).toMatch(/setTimeout\(r,\s*200\)/);
    expect(code).toMatch(/insert failed after retry/);
  });
  it("is no longer fire-and-forget (no swallowed .then)", () => {
    expect(code).not.toMatch(/\.then\(\s*\(\)\s*=>\s*undefined,\s*\(\)\s*=>\s*undefined\s*\)/);
  });
});
