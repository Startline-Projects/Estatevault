/**
 * A promo order owes the client the same documents a paid order does.
 *
 * The Stripe webhook creates document rows from expectedDocumentTypes(): three
 * for a Will Package, seven for a Trust Package, eight for a joint trust. The
 * free-promo and test-promo paths skipped the webhook and created rows from a
 * separate hardcoded list on the route config — four for a trust. A client who
 * redeemed a free code for a Trust Package never got the Certification of
 * Trust, the Assignment(s) of Personal Property or the Funding Instructions,
 * and /api/documents/status reported them missing forever.
 *
 * Both promo paths now ask the same function the webhook asks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { expectedDocumentTypes } from "@/lib/documents/trust-package";
import { VALID_WILL_INTAKE, VALID_TRUST_INTAKE } from "../fixtures/intake";

const h = vi.hoisted(() => ({
  orderDelete: vi.fn(),
  insertMany: vi.fn(),
  getByKey: vi.fn(),
  adminCreateUser: vi.fn(),
}));

function chain(row: unknown = null, listRow: unknown = []): unknown {
  const target: Record<string | symbol, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: listRow, error: null }).then(resolve),
    single: () => Promise.resolve({ data: row, error: null }),
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      return () => chain(row, listRow);
    },
  });
}

vi.mock("@/lib/api/auth", () => ({
  createAdminClient: () => ({
    from: () => chain({ id: "row-1" }),
    rpc: () => chain(null),
    auth: { admin: { createUser: h.adminCreateUser, updateUserById: vi.fn(), getUserById: vi.fn() } },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {}, get: () => undefined }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_1", url: "https://stripe.test" }) } } },
}));
vi.mock("@/lib/auth/emailVerification", () => ({
  peekVerifiedToken: vi.fn().mockResolvedValue(false),
  consumeVerifiedToken: vi.fn(),
}));
vi.mock("@/lib/repos/server/orderRepo", () => ({
  insert: vi.fn().mockResolvedValue({ data: { id: "order-1" }, error: null }),
  update: vi.fn().mockResolvedValue({ data: null, error: null }),
  deleteById: (...a: unknown[]) => h.orderDelete(...a),
}));
vi.mock("@/lib/repos/server/documentRepo", () => ({
  insertMany: (...a: unknown[]) => h.insertMany(...a),
}));
vi.mock("@/lib/repos/server/appSettingsRepo", () => ({
  getByKey: (...a: unknown[]) => h.getByKey(...a),
}));
vi.mock("@/lib/repos/server/profileRepo", () => ({
  getMeById: vi.fn().mockResolvedValue({ data: null }),
  findIdByEmailMaybe: vi.fn().mockResolvedValue({ data: null }),
  findIdByEmail: vi.fn().mockResolvedValue({ data: null }),
  upsert: vi.fn(),
}));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendPasswordChangedEmail: vi.fn(),
  resolveSenderForEmail: vi.fn(),
  sendEmail: vi.fn(),
  renderEmailHeader: () => "",
  renderEmailFooter: () => "",
}));

const JOINT_TRUST_INTAKE = {
  ...VALID_TRUST_INTAKE,
  isJointTrust: "Yes" as const,
  secondGrantorName: "Jane Doe",
  secondGrantorRelationship: "Spouse/Partner",
  jointTrusteeAuthority: "either_alone" as const,
};

/** Places the order; the caller asserts on status. */
async function order(product: "will" | "trust", intake: Record<string, unknown>, promoCode: string) {
  const route = product === "will"
    ? await import("@/app/api/checkout/will/route")
    : await import("@/app/api/checkout/trust/route");
  const email = `docset-${product}@example.test`;
  const res = await route.POST(new Request(`http://localhost/api/checkout/${product}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://estatevault.us" },
    body: JSON.stringify({ attorneyReview: false, intakeAnswers: { ...intake, email }, email, promoCode }),
  }) as never);
  const body = await res.json();
  const rows = (h.insertMany.mock.calls[0]?.[1] ?? []) as Array<{
    order_id: string; client_id?: string; document_type: string; status: string;
  }>;
  return { status: res.status, body, rows, types: rows.map((r) => r.document_type) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PROMO_CODES", "GIFT:free,PILOT:test");
  h.insertMany.mockResolvedValue({ error: null });
  h.orderDelete.mockResolvedValue({ data: null, error: null });
  h.getByKey.mockResolvedValue({ data: { value: { active: true } }, error: null });
  h.adminCreateUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

const SINGLE = [
  "trust", "certification_of_trust", "assignment_personal_property_g1",
  "pour_over_will", "trust_funding_instructions", "poa", "healthcare_directive",
];
const JOINT = [
  "trust", "certification_of_trust", "assignment_personal_property_g1", "assignment_personal_property_g2",
  "pour_over_will", "trust_funding_instructions", "poa", "healthcare_directive",
];

describe.each([
  { path: "free promo", code: "GIFT", flag: "free" },
  { path: "test promo", code: "PILOT", flag: "test" },
])("$path creates every document the order owes", ({ code, flag }) => {
  it("Trust Package, single grantor → seven", async () => {
    const { status, body, types } = await order("trust", VALID_TRUST_INTAKE, code);
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body[flag]).toBe(true);
    expect(types).toEqual(SINGLE);
  });

  it("Trust Package, joint → eight, one assignment per Grantor", async () => {
    const { types } = await order("trust", JOINT_TRUST_INTAKE, code);
    expect(types).toEqual(JOINT);
  });

  it("Will Package → three", async () => {
    const { types } = await order("will", VALID_WILL_INTAKE, code);
    expect(types).toEqual(["will", "poa", "healthcare_directive"]);
  });

  it("is exactly what the webhook would have created for the same order", async () => {
    const { rows, types } = await order("trust", JOINT_TRUST_INTAKE, code);
    expect(types).toEqual(expectedDocumentTypes("trust", JOINT_TRUST_INTAKE));
    expect(rows.every((r) => r.order_id === "order-1" && r.status === "pending")).toBe(true);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("the rows match the webhook's, column for column", () => {
  it("free promo: every row carries the client, so the documents reach the dashboard and can be downloaded", async () => {
    const { rows } = await order("trust", VALID_TRUST_INTAKE, "GIFT");
    expect(rows).toHaveLength(7);
    // "row-1" is the client row the admin stub returns for clients.insert().single()
    expect(rows.every((r) => r.client_id === "row-1")).toBe(true);
  });

  it("test promo: a test order has no client, and says so by omission", async () => {
    const { rows } = await order("trust", VALID_TRUST_INTAKE, "PILOT");
    expect(rows.every((r) => !("client_id" in r))).toBe(true);
  });
});

describe("an order whose document rows could not be created is not an order", () => {
  // Most likely cause: a database without 20260916_000_trust_package_document_types.sql,
  // whose document_type CHECK rejects the newer types. The insert is one statement,
  // so it creates no rows at all — and this used to answer 200 anyway.
  const CHECK_VIOLATION = { error: { message: 'violates check constraint "documents_document_type_check"' } };

  it.each([
    { path: "free promo", code: "GIFT" },
    { path: "test promo", code: "PILOT" },
  ])("$path: 500, and the order is rolled back", async ({ code }) => {
    h.insertMany.mockResolvedValue(CHECK_VIOLATION);
    const { status, body } = await order("trust", VALID_TRUST_INTAKE, code);
    expect(status).toBe(500);
    expect(body.free).toBeUndefined();
    expect(body.test).toBeUndefined();
    expect(h.orderDelete).toHaveBeenCalledWith(expect.anything(), "order-1");
  });
});

describe("there is one list, everywhere", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("the route configs no longer carry their own document lists", () => {
    for (const route of ["app/api/checkout/will/route.ts", "app/api/checkout/trust/route.ts"]) {
      expect(read(route), route).not.toMatch(/docTypes/);
    }
  });

  it("checkout and the webhook both ask expectedDocumentTypes", () => {
    const checkout = read("lib/checkout/createCheckoutSession.ts");
    expect(checkout).not.toMatch(/docTypes/);
    expect(checkout.match(/expectedDocumentTypes\(config\.productType, intakeAnswers\)/g)).toHaveLength(2);
    expect(read("lib/webhooks/stripe/handleDocumentCheckout.ts")).toContain("expectedDocumentTypes(productType,");
  });

  // Creating seven rows is only half of it. Each of these kept a private
  // four-type trust list, so the generators filled four rows and marked the
  // order delivered, and the monitors called that finished.
  it.each([
    "app/api/documents/process-now/route.ts",
    "app/api/documents/process/route.ts",
    "app/api/documents/generate/route.ts",
    "app/api/cron/reconcile-orders/route.ts",
    "app/api/admin/orders-missing-docs/route.ts",
  ])("%s generates / measures against the shared list", (file) => {
    const src = read(file);
    // Rows first (see tests/unit/order-document-set.test.ts for the behaviour).
    expect(src, file).toMatch(/documentTypesForOrder\(|orderDocumentProgress\(/);
    expect(src, file).not.toMatch(/EXPECTED_DOCS/);
    expect(src, file).not.toMatch(/\[\s*"trust"\s*,\s*"pour_over_will"/);
  });

  it("no other file in app/ or lib/ spells out a package's documents", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(join(__dirname, "..", "..", dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel); continue; }
        if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) continue;
        if (rel === "lib/documents/trust-package.ts") continue; // the one list
        if (/\[\s*["'`](?:trust|will)["'`]\s*,\s*["'`](?:pour_over_will|poa|certification_of_trust)["'`]/.test(read(rel))) offenders.push(rel);
      }
    };
    walk("app"); walk("lib");
    expect(offenders).toEqual([]);
  });
});
