/**
 * lib/config/contacts.ts — the two addresses code depends on.
 *
 * Each one is turned into a profile id by the Stripe webhook and is where mail
 * goes, so it must be spelled exactly once. The admin address was a personal
 * Gmail; the review recipient was a test placeholder that matched no account,
 * so every paid review was assigned to nobody. Both are now here, and nothing
 * else may spell them.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { PLATFORM_ADMIN_EMAIL, REVIEW_ATTORNEY_EMAIL } from "@/lib/config/contacts";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Every .ts/.tsx/.sql/.mjs file under the given dirs, repo-relative. */
function files(dirs: string[], skip: (rel: string) => boolean = () => false): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel); continue; }
      if (/\.(tsx?|sql|mjs)$/.test(e.name) && !skip(rel)) out.push(rel);
    }
  };
  dirs.forEach(walk);
  return out;
}
const RUNTIME = ["app", "lib", "components", "supabase"];

describe("the addresses", () => {
  it("platform admin is the platform mailbox", () => {
    expect(PLATFORM_ADMIN_EMAIL).toBe("info@estatevault.us");
  });

  it("review recipient is the pilot relay, and the file says so", () => {
    expect(REVIEW_ATTORNEY_EMAIL).toBe("ahm3dkass@gmail.com");
    expect(read("lib/config/contacts.ts")).toMatch(/PILOT RELAY/);
  });
});

describe("one source of truth", () => {
  it("both runtime consumers use the constants, never a literal", () => {
    expect(read("lib/email.ts")).toContain("to: PLATFORM_ADMIN_EMAIL");
    const webhook = read("lib/webhooks/stripe/handleAttorneyReview.ts");
    expect(webhook).toContain("findIdByEmailMaybe(supabase, REVIEW_ATTORNEY_EMAIL)");
    expect(webhook).toContain("findIdByEmailMaybe(supabase, PLATFORM_ADMIN_EMAIL)");
    // a missing account must be loud, not silent
    expect(webhook).toMatch(/if \(!reviewerProfile\)[\s\S]{0,40}console\.error/);
    expect(webhook).toMatch(/if \(!adminProfile\)[\s\S]{0,40}console\.error/);
  });

  it("the routing module no longer carries either address", () => {
    const routing = read("lib/attorney-review/routing.ts");
    expect(routing).not.toMatch(/INHOUSE_ATTORNEY_EMAIL|ESTATEVAULT_ADMIN_EMAIL/);
    expect(routing).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i); // no email literal at all
  });

  it("the account-creation scripts create the accounts the webhook will look for", () => {
    for (const s of ["scripts/create-admin.ts", "scripts/reset-db.ts"]) {
      expect(read(s), s).toContain('from "../lib/config/contacts"');
      expect(read(s), s).toContain("const ADMIN_EMAIL = PLATFORM_ADMIN_EMAIL");
    }
    for (const s of ["scripts/create-review-attorney.ts", "scripts/reassign-pending-reviews.ts"]) {
      expect(read(s), s).toContain('from "../lib/config/contacts"');
      expect(read(s), s).toContain("REVIEW_ATTORNEY_EMAIL");
    }
  });

  it("the seed migration, which cannot import, names the same admin address", () => {
    const sql = read("supabase/migrations/20260401_001_seed_mo_review_attorney.sql");
    expect(sql).toContain(`email = '${PLATFORM_ADMIN_EMAIL}'`);
  });

  it("the review recipient is spelled nowhere else in code, scripts or migrations", () => {
    const offenders = files([...RUNTIME, "scripts"], (rel) => rel === "lib/config/contacts.ts")
      .filter((rel) => read(rel).includes(REVIEW_ATTORNEY_EMAIL));
    expect(offenders).toEqual([]);
  });

  it("nothing else looks a profile up by a literal admin address", () => {
    // info@estatevault.us is also the platform's sender/support address, so the
    // literal is allowed in mail and page copy — but never as a lookup key.
    const offenders = files([...RUNTIME, "scripts"], (rel) => rel === "lib/config/contacts.ts")
      .filter((rel) => /(findIdByEmail\w*\(|\.eq\(\s*["']email["']\s*,)\s*[^)]*["']info@estatevault\.us["']/.test(read(rel)));
    expect(offenders).toEqual([]);
  });
});

describe("no placeholder addresses in runtime code", () => {
  // Test fixtures (tests/, tests/fixtures/users.ts) and the staging test-user
  // seeder are allowed to use @estatevault.test — that is what it is for.
  const PLACEHOLDER = /@estatevault\.test\b|@example\.test\b|test-attorney@|ockmedk/i;

  it("app/, lib/, components/ and supabase/ contain none", () => {
    const offenders: string[] = [];
    for (const rel of files(RUNTIME)) {
      const hits = read(rel).match(new RegExp(`[A-Za-z0-9._%+-]*(${PLACEHOLDER.source})[A-Za-z0-9.-]*`, "gi")) ?? [];
      if (hits.length) offenders.push(`${rel}: ${Array.from(new Set(hits)).join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});
