/**
 * Core Rule 4 at the API boundary — the checkout gate.
 *
 * evaluateHardStop was already covered for all three triggers, and so was the
 * gate in createCheckoutSession — but every one of those tests handed the
 * evaluator a hand-built object. None parsed a request through the checkout
 * schema first. That is where the special-needs trigger went missing: the
 * questionnaire asked it, the intake type carried it, and z.object() stripped
 * it, so the gate never saw a "Yes". A client who answered Yes got a Stripe
 * checkout URL.
 *
 * These tests travel the chain the way a real request does — raw JSON body →
 * route → Zod → evaluator → 409 — for every trigger, on both products, and
 * pin that no order row and no Stripe session is created on the way.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { willCheckoutSchema, trustCheckoutSchema } from "@/lib/validation/schemas";
import { evaluateHardStop, HARD_STOP_REASONS } from "@/lib/compliance/hardStop";
import { VALID_WILL_INTAKE, VALID_TRUST_INTAKE, HARD_STOP_TRIGGERS } from "../fixtures/intake";

const h = vi.hoisted(() => ({
  orderInsert: vi.fn(),
  orderUpdate: vi.fn(),
  stripeCreate: vi.fn(),
  adminCreateUser: vi.fn(),
}));

/** A query builder that answers any method with itself and resolves when awaited. */
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
  stripe: { checkout: { sessions: { create: (...a: unknown[]) => h.stripeCreate(...a) } } },
}));
vi.mock("@/lib/auth/emailVerification", () => ({
  peekVerifiedToken: vi.fn().mockResolvedValue(false),
  consumeVerifiedToken: vi.fn(),
}));
vi.mock("@/lib/repos/server/orderRepo", () => ({
  insert: (...a: unknown[]) => h.orderInsert(...a),
  update: (...a: unknown[]) => h.orderUpdate(...a),
  deleteById: vi.fn().mockResolvedValue({ data: null, error: null }),
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

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

async function checkout(product: "will" | "trust", intakeAnswers: Record<string, unknown>) {
  const route = product === "will"
    ? await import("@/app/api/checkout/will/route")
    : await import("@/app/api/checkout/trust/route");
  const email = `${product}-gate@example.test`;
  return route.POST(post(`http://localhost/api/checkout/${product}`, {
    attorneyReview: false,
    intakeAnswers: { ...intakeAnswers, email },
    email,
    promoCode: "SMOKE",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // A configured free code keeps the control case off Stripe entirely.
  vi.stubEnv("PROMO_CODES", "SMOKE:free");
  h.orderInsert.mockResolvedValue({ data: { id: "order-1" }, error: null });
  h.orderUpdate.mockResolvedValue({ data: null, error: null });
  h.stripeCreate.mockResolvedValue({ id: "cs_1", url: "https://stripe.test" });
  h.adminCreateUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

const PRODUCTS = [
  { product: "will" as const, schema: willCheckoutSchema, intake: VALID_WILL_INTAKE },
  { product: "trust" as const, schema: trustCheckoutSchema, intake: VALID_TRUST_INTAKE },
];

describe.each(PRODUCTS)("$product: every trigger survives the schema and halts", ({ schema, intake }) => {
  it.each(HARD_STOP_TRIGGERS)("$name", ({ field, reason }) => {
    const parsed = schema.parse({ intakeAnswers: { ...intake, [field]: "Yes" } });
    const answers = parsed.intakeAnswers as Record<string, unknown>;
    expect(answers[field]).toBe("Yes");
    expect(evaluateHardStop(answers)).toEqual({ halted: true, reasons: [reason] });
  });

  it("a clean intake parses and does not halt", () => {
    const parsed = schema.parse({ intakeAnswers: intake });
    expect(evaluateHardStop(parsed.intakeAnswers as Record<string, unknown>)).toEqual({ halted: false, reasons: [] });
  });

  it("all three at once are all reported, in the evaluator's order", () => {
    const allYes = Object.fromEntries(HARD_STOP_TRIGGERS.map((t) => [t.field, "Yes"]));
    const parsed = schema.parse({ intakeAnswers: { ...intake, ...allYes } });
    expect(evaluateHardStop(parsed.intakeAnswers as Record<string, unknown>).reasons).toEqual([
      HARD_STOP_REASONS.specialNeeds,
      HARD_STOP_REASONS.medicaid,
      HARD_STOP_REASONS.estateDispute,
    ]);
  });
});

describe.each(PRODUCTS)("$product checkout route refuses every trigger before any side effect", ({ product, intake }) => {
  it.each(HARD_STOP_TRIGGERS)("$name → 409, no order, no Stripe", async ({ field, reason }) => {
    const res = await checkout(product, { ...intake, [field]: "Yes" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      hardStop: true,
      reasons: [reason],
      referralPath: "/attorney-referral",
    });
    expect(h.orderInsert).not.toHaveBeenCalled();
    expect(h.stripeCreate).not.toHaveBeenCalled();
  });

  it("the same request with every trigger answered No goes through", async () => {
    const res = await checkout(product, intake);
    // Guard against a false pass: a 400 here means the fixture, not the gate.
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect(await res.json()).toMatchObject({ free: true, orderId: "order-1" });
    expect(h.orderInsert).toHaveBeenCalledTimes(1);
  });

  it("irrevocable trust is no longer a hard stop: an old client still sending the answer is served, not halted", async () => {
    // Removed 2026-09-18. z.object() strips the undeclared key, so a cached page
    // that still posts it is neither rejected nor routed to an attorney.
    const res = await checkout(product, { ...intake, wantsIrrevocableTrust: "Yes" });
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect(await res.json()).toMatchObject({ free: true });
    expect(h.orderInsert).toHaveBeenCalledTimes(1);
  });

  it("an unanswered trigger is a validation error, not a pass", async () => {
    const { hasSpecialNeedsDependent: _omit, ...without } = intake;
    const res = await checkout(product, without);
    expect(res.status).toBe(400);
    // The two routes word this differently (will names the top-level key, trust
    // spells out the path); what matters here is that it is a refusal.
    expect((await res.json()).error).toMatch(/validation failed/i);
    expect(h.orderInsert).not.toHaveBeenCalled();
    expect(h.stripeCreate).not.toHaveBeenCalled();
  });
});
