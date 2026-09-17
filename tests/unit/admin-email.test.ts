/**
 * The platform admin's address.
 *
 * One constant does two jobs: it is where fulfilment-failure alerts go, and it
 * is the email the Stripe webhook uses to find the admin's PROFILE for every
 * paid attorney review. It was a personal Gmail address; it is now the
 * platform's own mailbox, and the old address must not creep back in.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { ESTATEVAULT_ADMIN_EMAIL } from "@/lib/attorney-review/routing";

const ROOT = join(__dirname, "..", "..");

describe("platform admin email", () => {
  it("is the platform mailbox", () => {
    expect(ESTATEVAULT_ADMIN_EMAIL).toBe("info@estatevault.us");
  });

  it("alerts and the admin-profile lookup both use the constant, not a literal", () => {
    expect(readFileSync(join(ROOT, "lib/email.ts"), "utf8")).toContain("to: ESTATEVAULT_ADMIN_EMAIL");
    const webhook = readFileSync(join(ROOT, "lib/webhooks/stripe/handleAttorneyReview.ts"), "utf8");
    expect(webhook).toContain("findIdByEmailMaybe(supabase, ESTATEVAULT_ADMIN_EMAIL)");
    // a missing admin or attorney account must be loud, not silent
    expect(webhook).toMatch(/if \(!adminProfile\)[\s\S]{0,40}console\.error/);
    expect(webhook).toMatch(/if \(!moProfile\)[\s\S]{0,40}console\.error/);
  });

  it("the old personal address is gone from the code, the scripts and the migrations", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel); continue; }
        if (!/\.(tsx?|sql|mjs|json)$/.test(e.name)) continue;
        if (rel === "tests/unit/admin-email.test.ts") continue;
        if (/ockmedk/i.test(readFileSync(join(ROOT, rel), "utf8"))) offenders.push(rel);
      }
    };
    for (const d of ["app", "lib", "components", "scripts", "supabase", "tests"]) walk(d);
    expect(offenders).toEqual([]);
  });
});
