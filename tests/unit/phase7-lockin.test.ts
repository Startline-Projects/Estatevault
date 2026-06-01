import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Phase 7 — Lock It In regression suite.
 *
 * 7.1 ESLint enforcement (error-level bans), 7.2 CI gate, 7.3 doc cleanup
 * (L-03/L-04), 7.4 typed API client + no raw fetch("/api/...").
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

// ---------------------------------------------------------------------------
// 7.1 — ESLint rules promoted to error
// ---------------------------------------------------------------------------
describe("7.1 ESLint enforcement", () => {
  const cfg = src(".eslintrc.json");
  it("bans raw fetch(\"/api/...\") in components", () => {
    expect(cfg).toMatch(/callee\.name='fetch'/);
    expect(cfg).toMatch(/lib\/api-client\//);
  });
  it("bans locally redeclared createAdminClient", () => {
    expect(cfg).toMatch(/createAdminClient/);
  });
  it("bans .from() on vault tables outside lib/repos", () => {
    expect(cfg).toMatch(/vault_items\|vault_trustees\|farewell_messages/);
  });
  it("bans Math.random() in API routes", () => {
    expect(cfg).toMatch(/crypto\.randomBytes\(\) instead of Math\.random/);
  });
  it("bans console.log of key material", () => {
    expect(cfg).toMatch(/mk\|dek\|kek\|masterKey/);
  });
  it("the rules are error-level, not warn", () => {
    expect(cfg).toMatch(/"no-restricted-syntax":\s*\[\s*"error"/);
  });
});

// ---------------------------------------------------------------------------
// 7.2 — CI gate runs tsc + lint + test
// ---------------------------------------------------------------------------
describe("7.2 CI gate", () => {
  it(".github/workflows/ci.yml exists and runs the full gate", () => {
    expect(existsSync(join(ROOT, ".github/workflows/ci.yml"))).toBe(true);
    const yml = src(".github/workflows/ci.yml");
    expect(yml).toMatch(/tsc --noEmit/);
    expect(yml).toMatch(/npm run lint/);
    expect(yml).toMatch(/npm test/);
  });
});

// ---------------------------------------------------------------------------
// 7.3 — doc cleanup (L-03)
// ---------------------------------------------------------------------------
describe("7.3 doc cleanup", () => {
  const doc = src("app/CLAUDE.md");
  it("app/CLAUDE.md no longer references the obsolete /lib/db path", () => {
    expect(doc).not.toMatch(/\/lib\/db\b/);
  });
  it("app/CLAUDE.md no longer pins a stale build phase", () => {
    expect(doc).not.toMatch(/PHASE 1|Current phase/);
  });
  it("describes the current repo/kernel architecture", () => {
    expect(doc).toMatch(/lib\/repos/);
    expect(doc).toMatch(/withRoute|requireAuth/);
  });
});

// ---------------------------------------------------------------------------
// 7.4 — typed API client; no raw fetch("/api/...") in UI
// ---------------------------------------------------------------------------
describe("7.4 typed API client", () => {
  const clientModules = [
    "client.ts", "auth.ts", "checkout.ts", "vault.ts", "subscription.ts",
    "documents.ts", "partner.ts", "sales.ts", "trustee.ts", "farewell.ts", "misc.ts", "index.ts",
  ];
  for (const m of clientModules) {
    it(`lib/api-client/${m} exists`, () => {
      expect(existsSync(join(ROOT, `lib/api-client/${m}`))).toBe(true);
    });
  }

  it("core client exposes typed verbs returning ApiResult", () => {
    const code = src("lib/api-client/client.ts");
    for (const verb of ["get", "post", "put", "patch", "del"]) {
      expect(code).toMatch(new RegExp(`export async function ${verb}<T>`));
    }
    expect(code).toMatch(/ApiResult/);
  });

  it("index re-exports a namespace per domain", () => {
    const idx = src("lib/api-client/index.ts");
    for (const ns of ["authApi", "checkoutApi", "vaultApi", "salesApi", "partnerApi"]) {
      expect(idx).toMatch(new RegExp(`export \\* as ${ns}`));
    }
  });

  it("no raw fetch(\"/api/...\") remains in app/ or components/", () => {
    const files = [...walk("app", [".tsx", ".ts"]), ...walk("components", [".tsx", ".ts"])].filter(
      (f) => !f.includes(".test.") && !f.startsWith("lib/api-client/")
    );
    const offenders = files.filter((f) => /fetch\(\s*["'`]\/api\//.test(src(f)));
    expect(offenders).toEqual([]);
  });
});
