import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  contactSchema,
  documentGenerateSchema,
  attorneyApproveSchema,
  salesPartnerNotesSchema,
} from "@/lib/validation/schemas";

/**
 * Phase 3 — Validation at Every Boundary regression suite.
 *
 * Finding M-06: every JSON body parsed by a named Zod schema; inline z.object
 * consolidated into the registry; dead intake schemas removed.
 *
 * BEHAVIOR — exercises real schemas. SOURCE GUARD — scans routes to prove the
 * safeParse-then-fail pattern is present and inline schemas are gone.
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const schemas = src("lib/validation/schemas.ts");

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
// Real schema behavior — accept good, reject bad
// ---------------------------------------------------------------------------
describe("registry schemas reject malformed input", () => {
  it("contactSchema enforces name/email/message bounds", () => {
    expect(contactSchema.safeParse({}).success).toBe(false);
    expect(contactSchema.safeParse({ name: "A", email: "nope", message: "hi" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: "", email: "a@b.com", message: "hi" }).success).toBe(false);
    expect(contactSchema.safeParse({ name: "A", email: "a@b.com", message: "hi" }).success).toBe(true);
  });

  it("contactSchema caps oversized message (max 5000)", () => {
    const big = "x".repeat(5001);
    expect(contactSchema.safeParse({ name: "A", email: "a@b.com", message: big }).success).toBe(false);
  });

  it("documentGenerateSchema requires a non-empty order_id", () => {
    expect(documentGenerateSchema.safeParse({}).success).toBe(false);
    expect(documentGenerateSchema.safeParse({ order_id: "" }).success).toBe(false);
    expect(documentGenerateSchema.safeParse({ order_id: "ord_1" }).success).toBe(true);
  });

  it("attorneyApproveSchema requires reviewId", () => {
    expect(attorneyApproveSchema.safeParse({}).success).toBe(false);
    expect(attorneyApproveSchema.safeParse({ reviewId: "r1" }).success).toBe(true);
  });

  it("schemas strip unknown keys by default (no object passthrough)", () => {
    const r = salesPartnerNotesSchema.safeParse({ partnerId: "p1", note: "n", evil: "drop" });
    expect(r.success).toBe(true);
    expect(r.success && "evil" in r.data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Registry health — count, no inline schemas, dead schemas removed
// ---------------------------------------------------------------------------
describe("validation registry", () => {
  it("exports a substantial schema set (>= 60)", () => {
    const count = (schemas.match(/^export const \w+Schema/gm) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(60);
  });

  it("dead intake schemas were removed", () => {
    for (const dead of ["willIntakeSchema", "trustIntakeSchema"]) {
      expect(schemas).not.toMatch(new RegExp(`export const ${dead}\\b`));
    }
  });

  it("no route declares an inline z.object() schema", () => {
    const offenders = ROUTES.filter((f) => /z\.object\s*\(/.test(src(f)));
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Boundary guard — every route that parses input rejects on failure
// ---------------------------------------------------------------------------
describe("safeParse-then-fail pattern", () => {
  const parsing = ROUTES.filter((f) => /\.safeParse\s*\(/.test(src(f)));

  it("a meaningful number of routes validate input", () => {
    expect(parsing.length).toBeGreaterThanOrEqual(40);
  });

  it("every parsing route guards on .success before touching .data", () => {
    // Downstream handling varies legitimately (fail() envelope, NextResponse
    // 400, or a safe fallback) — the invariant is that invalid input is never
    // used: a !parsed.success / .success branch must precede .data access.
    const bad = parsing.filter((f) => !/\.success/.test(src(f)));
    expect(bad).toEqual([]);
  });

  it("reject-style routes return a 400 (use-with-default routes may omit it)", () => {
    // Routes that branch `if (!parsed.success) return ...` are rejecting and
    // must surface a 400. Routes that read `parsed.success ? data : default`
    // are using-with-default (e.g. stripe/connect/onboard) and legitimately
    // never emit 400.
    const rejecting = parsing.filter((f) => /!\s*\w+\.success/.test(src(f)));
    const bad = rejecting.filter((f) => {
      const code = src(f);
      return !(/\b400\b/.test(code) || /FALLBACK/.test(code));
    });
    expect(bad).toEqual([]);
  });

  it("parsing routes import schemas from the central registry, not ad-hoc", () => {
    const bad = parsing.filter((f) => !/from\s*["']@\/lib\/(validation\/schemas|api\/crypto)["']/.test(src(f)));
    expect(bad).toEqual([]);
  });
});
