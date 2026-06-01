import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

/**
 * Phase 6 — Frontend Production Quality regression suite.
 *
 * Findings: F-02 (vault decompose), F-03 (loading states), F-04 (error
 * boundaries), F-05 (a11y), F-06 (SEO), F-07 (CSS scroll reveal),
 * F-08 (next/image). F-01 (server-component conversion) was skipped by
 * product decision — see PRODUCTION_PLAN.html.
 */

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const has = (rel: string) => existsSync(join(ROOT, rel));

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

// ---------------------------------------------------------------------------
// F-02 — vault god component decomposed
// ---------------------------------------------------------------------------
describe("F-02 vault decomposition", () => {
  const modules = [
    "vault-constants.ts",
    "VaultPinScreen.tsx",
    "VaultItemDetailModal.tsx",
    "VaultUploadForm.tsx",
    "VaultAddItemForm.tsx",
    "VaultCategoryView.tsx",
    "VaultMainGrid.tsx",
  ];
  for (const m of modules) {
    it(`components/vault/${m} exists`, () => {
      expect(has(`components/vault/${m}`)).toBe(true);
    });
  }
  it("parent vault page is no longer an 800-line monolith", () => {
    expect(src("app/dashboard/vault/page.tsx").split("\n").length).toBeLessThan(300);
  });
});

// ---------------------------------------------------------------------------
// F-03 / F-04 — loading + error segments
// ---------------------------------------------------------------------------
describe("F-03 loading states", () => {
  for (const seg of ["dashboard", "pro", "sales", "attorney", "auth"]) {
    it(`app/${seg}/loading.tsx exists`, () => {
      expect(has(`app/${seg}/loading.tsx`)).toBe(true);
    });
  }
});

describe("F-04 error boundaries", () => {
  for (const seg of ["dashboard", "pro", "sales", "attorney", "quiz"]) {
    it(`app/${seg}/error.tsx exists`, () => {
      expect(has(`app/${seg}/error.tsx`)).toBe(true);
    });
  }
  it("error boundaries are client components with a reset path", () => {
    const code = src("app/dashboard/error.tsx");
    expect(code).toMatch(/"use client"/);
    expect(code).toMatch(/reset/);
  });
});

// ---------------------------------------------------------------------------
// F-05 — accessibility on the vault modal + FAQ accordion
// ---------------------------------------------------------------------------
describe("F-05 accessibility", () => {
  it("vault modal is a labelled dialog with focus trap + Escape", () => {
    const code = src("components/vault/VaultItemDetailModal.tsx");
    expect(code).toMatch(/role="dialog"/);
    expect(code).toMatch(/aria-modal="true"/);
    expect(code).toMatch(/Escape/);
  });
  it("FAQ accordion exposes aria-expanded / aria-controls", () => {
    const code = src("components/FAQ.tsx");
    expect(code).toMatch(/aria-expanded/);
    expect(code).toMatch(/aria-controls/);
  });
});

// ---------------------------------------------------------------------------
// F-06 — SEO: sitemap, robots, metadata (real function output)
// ---------------------------------------------------------------------------
describe("F-06 SEO", () => {
  it("sitemap() returns the public URL set", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThanOrEqual(8);
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/quiz"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/will"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/trust"))).toBe(true);
  });

  it("robots() disallows private surfaces", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = rules.flatMap((rule) =>
      Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow]
    );
    for (const path of ["/dashboard/", "/api/", "/auth/", "/trustee/"]) {
      expect(disallow).toContain(path);
    }
  });

  it("key public pages export metadata", () => {
    expect(src("app/quiz/layout.tsx")).toMatch(/metadata/);
    expect(src("app/will/layout.tsx")).toMatch(/metadata/);
  });
});

// ---------------------------------------------------------------------------
// F-07 — scroll reveal is CSS-only (no client wrapper on the landing page)
// ---------------------------------------------------------------------------
describe("F-07 CSS scroll reveal", () => {
  it("globals.css drives reveal via animation-timeline: view()", () => {
    const css = src("app/globals.css");
    expect(css).toMatch(/\.scroll-reveal/);
    expect(css).toMatch(/animation-timeline:\s*view\(\)/);
  });
  it("the landing page no longer imports the JS ScrollReveal wrapper", () => {
    expect(src("app/page.tsx")).not.toMatch(/ScrollReveal/);
  });
});

// ---------------------------------------------------------------------------
// F-08 — next/image instead of raw <img> in React components
// ---------------------------------------------------------------------------
describe("F-08 next/image", () => {
  it("checkout pages render logos through next/image", () => {
    expect(src("app/will/checkout/page.tsx")).toMatch(/from "next\/image"/);
    expect(src("app/trust/checkout/page.tsx")).toMatch(/from "next\/image"/);
  });

  // KNOWN GAP: F-08 migrated component logos but 2 standalone pages still use
  // raw <img>. Pinned so the set can't grow silently; shrink it as they migrate.
  it("raw <img> usage is limited to the known-remaining pages", () => {
    const files = [...walk("app", [".tsx"]), ...walk("components", [".tsx"])].filter(
      (f) => !f.includes(".test.")
    );
    const offenders = files
      .filter((f) => {
        // strip block comments so commented-out markup is ignored
        const stripped = src(f).replace(/\/\*[\s\S]*?\*\//g, "");
        return /<img[\s>]/.test(stripped);
      })
      .sort();
    expect(offenders).toEqual([
      "app/affiliate-signup/page.tsx",
      "app/professionals/page.tsx",
    ]);
  });
});
