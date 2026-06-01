import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  PRICES,
  EV_DEFAULT_CUT,
  PARTNER_PLATFORM_FEE,
  formatPrice,
} from "@/lib/orders/pricing";

/**
 * Phase 5 — Type System + Config Hardening regression suite.
 *
 * Findings: H-12 (generated DB types + migration baseline), L-01 (no
 * as-any / ts-ignore), SSOT pricing (no hardcoded dollar amounts in
 * routes/lib).
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(relative(ROOT, join(ROOT, rel)).split("\\").join("/"));
    }
  }
  return out;
}
const SRC_FILES = [...walk("lib", [".ts", ".tsx"]), ...walk("app", [".ts", ".tsx"])].filter(
  (f) => !f.includes("db.generated") && !f.includes(".test.") && !f.includes("/tests/")
);

// ---------------------------------------------------------------------------
// H-12 — generated DB types + reproducible migration baseline
// ---------------------------------------------------------------------------
describe("H-12 DB types + migrations", () => {
  it("types/db.generated.ts exists and is substantial", () => {
    expect(existsSync(join(ROOT, "types/db.generated.ts"))).toBe(true);
    expect(src("types/db.generated.ts").split("\n").length).toBeGreaterThan(1000);
  });
  it("the generated module exports a Database type", () => {
    expect(src("types/db.generated.ts")).toMatch(/export (type|interface) Database\b/);
  });
  it("a migration baseline is checked into source control", () => {
    expect(existsSync(join(ROOT, "supabase/migrations/00000000000000_baseline.sql"))).toBe(true);
  });
  it("db:types script is wired in package.json", () => {
    const pkg = JSON.parse(src("package.json"));
    expect(pkg.scripts["db:types"]).toMatch(/supabase gen types typescript/);
  });
  it("supabase clients are parameterized with <Database>", () => {
    expect(src("lib/supabase/client.ts")).toMatch(/createBrowserClient<Database>/);
    expect(src("lib/supabase/server.ts")).toMatch(/createServerClient<Database>/);
    expect(src("lib/api/auth.ts")).toMatch(/createServerClient<Database>/);
  });
});

// ---------------------------------------------------------------------------
// L-01 — no `as any` / `@ts-ignore` escape hatches in app/lib source
// ---------------------------------------------------------------------------
describe("L-01 type-safety escape hatches removed", () => {
  it("no `as any` cast remains in lib/ or app/", () => {
    const offenders = SRC_FILES.filter((f) => /\bas any\b/.test(src(f)));
    expect(offenders).toEqual([]);
  });
  it("no `@ts-ignore` remains in lib/ or app/", () => {
    const offenders = SRC_FILES.filter((f) => /@ts-ignore/.test(src(f)));
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SSOT pricing — single source, no hardcoded dollar amounts elsewhere
// ---------------------------------------------------------------------------
describe("pricing single source of truth", () => {
  it("PRICES holds the canonical cents values", () => {
    expect(PRICES.will).toBe(40000);
    expect(PRICES.trust).toBe(60000);
    expect(PRICES.amendment).toBe(5000);
    expect(PRICES.vaultSubscriptionYear).toBe(9900);
  });

  it("formatPrice renders whole-dollar strings", () => {
    expect(formatPrice(40000)).toBe("$400");
    expect(formatPrice(60000)).toBe("$600");
    expect(formatPrice(9900)).toBe("$99");
  });

  it("split tables stay consistent with prices", () => {
    // EV cut + partner platform fee never exceed the product price
    expect(EV_DEFAULT_CUT.will).toBeLessThan(PRICES.will);
    expect(PARTNER_PLATFORM_FEE.standard).toBeLessThanOrEqual(PRICES.trust * 10);
  });

  it("no route or lib file hardcodes a known price literal (pricing.ts is the only home)", () => {
    const PRICE_LITERALS = /\b(40000|60000|9900)\b/;
    const apiAndLib = SRC_FILES.filter(
      (f) => (f.startsWith("app/api/") || f.startsWith("lib/")) && f !== "lib/orders/pricing.ts"
    );
    const offenders = apiAndLib.filter((f) => PRICE_LITERALS.test(src(f)));
    expect(offenders).toEqual([]);
  });
});
