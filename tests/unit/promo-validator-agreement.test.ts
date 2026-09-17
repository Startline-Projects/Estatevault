/**
 * The promo validator and the promo charger must agree, in both directions.
 *
 * POST /api/checkout/validate-promo is what the checkout page asks before it
 * lets a client commit. createCheckoutSession is what actually honours the code.
 * The validator used to keep its own hardcoded list (FREE134, TEST) while the
 * charger read PROMO_CODES, so a configured code showed as "Invalid promo
 * code." and a retired one showed as valid — then went to Stripe at full price.
 *
 * Every case below runs the same code through both and asserts one verdict.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { promoDecision, promoKind, isPromoEnabled, TEST_PROMO_SWITCH_KEY } from "@/lib/orders/promo";
import { VALID_WILL_INTAKE } from "../fixtures/intake";

const h = vi.hoisted(() => ({
  orderInsert: vi.fn(),
  stripeCreate: vi.fn(),
  adminCreateUser: vi.fn(),
  getByKey: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  apiRateLimit: { limit: (...a: unknown[]) => h.rateLimit(...a) },
  checkoutRateLimit: { limit: (...a: unknown[]) => h.rateLimit(...a) },
  authRateLimit: { limit: (...a: unknown[]) => h.rateLimit(...a) },
  authIpRateLimit: { limit: (...a: unknown[]) => h.rateLimit(...a) },
  clientIp: () => "203.0.113.7",
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
vi.mock("@/lib/repos/server/appSettingsRepo", () => ({
  getByKey: (...a: unknown[]) => h.getByKey(...a),
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
  update: vi.fn().mockResolvedValue({ data: null, error: null }),
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

const TRUSTED = "https://estatevault.us";
const UNTRUSTED = "https://evil.example";

function post(url: string, body: unknown, origin = TRUSTED) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  }) as never;
}

/** What the checkout page hears. */
async function validator(code: string, origin = TRUSTED) {
  const { POST } = await import("@/app/api/checkout/validate-promo/route");
  const res = await POST(post("http://localhost/api/checkout/validate-promo", { code }, origin));
  return { status: res.status, body: await res.json() };
}

/** What the charger does with the same code. */
async function charger(code: string, origin = TRUSTED) {
  const { POST } = await import("@/app/api/checkout/will/route");
  const email = "promo-agreement@example.test";
  const res = await POST(post("http://localhost/api/checkout/will", {
    attorneyReview: false,
    intakeAnswers: { ...VALID_WILL_INTAKE, email },
    email,
    promoCode: code,
  }, origin));
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

function switchOn(on: boolean) {
  h.getByKey.mockResolvedValue({ data: { value: { active: on } }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rateLimit.mockResolvedValue({ success: true });
  h.orderInsert.mockResolvedValue({ data: { id: "order-1" }, error: null });
  h.stripeCreate.mockResolvedValue({ id: "cs_1", url: "https://stripe.test/session" });
  h.adminCreateUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
  switchOn(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("promoDecision — the one verdict both sides use", () => {
  beforeEach(() => vi.stubEnv("PROMO_CODES", "LAUNCH:free,PILOT:test"));
  const ctx = { testSwitchOn: true, trustedOrigin: true };

  it("a configured free code is honoured, whatever the case", () => {
    expect(promoDecision("LAUNCH", ctx)).toEqual({ accepted: true, kind: "free" });
    expect(promoDecision(" launch ", ctx)).toEqual({ accepted: true, kind: "free" });
  });
  it("an unconfigured code is refused, including the codes that used to be hardcoded", () => {
    for (const code of ["FREE134", "TPFP", "FREE676", "TEST", "", undefined, null]) {
      expect(promoDecision(code, ctx)).toMatchObject({ accepted: false, kind: null, refusal: "unknown_code" });
    }
  });
  it("a test code needs a trusted origin and the admin switch, in that order", () => {
    expect(promoDecision("PILOT", ctx)).toEqual({ accepted: true, kind: "test" });
    expect(promoDecision("PILOT", { testSwitchOn: true, trustedOrigin: false }))
      .toEqual({ accepted: false, kind: "test", refusal: "untrusted_origin" });
    expect(promoDecision("PILOT", { testSwitchOn: false, trustedOrigin: true }))
      .toEqual({ accepted: false, kind: "test", refusal: "test_switch_off" });
    expect(promoDecision("PILOT", { testSwitchOn: false, trustedOrigin: false }))
      .toEqual({ accepted: false, kind: "test", refusal: "untrusted_origin" });
  });
  it("the older helpers answer from the same set", () => {
    expect(promoKind("LAUNCH")).toBe("free");
    expect(isPromoEnabled("PILOT")).toBe(true);
    expect(isPromoEnabled("FREE134")).toBe(false);
  });
});

describe("validator and charger agree — free codes", () => {
  beforeEach(() => vi.stubEnv("PROMO_CODES", "SMOKE:free"));

  it("a configured free code: valid to the page, free to the charger", async () => {
    expect(await validator("SMOKE")).toEqual({ status: 200, body: { valid: true, kind: "free" } });
    const c = await charger("SMOKE");
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body).toMatchObject({ free: true, orderId: "order-1" });
    expect(h.stripeCreate).not.toHaveBeenCalled();
  });

  it("case does not matter to either side", async () => {
    expect((await validator("smoke")).body).toEqual({ valid: true, kind: "free" });
    expect((await charger("smoke")).body).toMatchObject({ free: true });
  });

  it.each(["FREE134", "TPFP", "FREE676", "TEST"])(
    "the retired hardcoded code %s: invalid to the page, full price to the charger",
    async (code) => {
      expect((await validator(code)).body).toEqual({ valid: false, kind: null });
      const c = await charger(code);
      expect(c.status).toBe(200);
      expect(c.body.free).toBeUndefined();
      expect(c.body.test).toBeUndefined();
      expect(c.body.url).toBe("https://stripe.test/session"); // paid path
    },
  );

  it("a made-up code: both refuse", async () => {
    expect((await validator("NOPE")).body).toEqual({ valid: false, kind: null });
    expect((await charger("NOPE")).body).toMatchObject({ url: "https://stripe.test/session" });
  });

  it("no code at all is a 400 from the validator, and the paid path from the charger", async () => {
    expect((await validator("")).status).toBe(400);
    expect((await charger("")).body).toMatchObject({ url: "https://stripe.test/session" });
  });
});

describe("validator and charger agree — test codes", () => {
  beforeEach(() => vi.stubEnv("PROMO_CODES", "PILOT:test"));

  it("switch on, trusted origin: valid to the page, a test order from the charger", async () => {
    expect((await validator("PILOT")).body).toEqual({ valid: true, kind: "test" });
    const c = await charger("PILOT");
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body).toMatchObject({ test: true, orderId: "order-1" });
    expect(h.stripeCreate).not.toHaveBeenCalled();
    // both read the same switch
    expect(h.getByKey).toHaveBeenCalledWith(expect.anything(), TEST_PROMO_SWITCH_KEY);
  });

  it("switch off: both refuse, and the charger says why", async () => {
    switchOn(false);
    expect((await validator("PILOT")).body).toEqual({ valid: false, kind: null });
    const c = await charger("PILOT");
    expect(c.status).toBe(400);
    expect(c.body).toEqual({ error: "This code is not valid" });
    expect(h.orderInsert).not.toHaveBeenCalled();
  });

  it("untrusted origin: both refuse, and neither reads the switch", async () => {
    expect((await validator("PILOT", UNTRUSTED)).body).toEqual({ valid: false, kind: null });
    expect(h.getByKey).not.toHaveBeenCalled();
    const c = await charger("PILOT", UNTRUSTED);
    expect(c.status).toBe(400);
    expect(c.body).toEqual({ error: "Invalid promo code." });
    expect(h.getByKey).not.toHaveBeenCalled();
    expect(h.orderInsert).not.toHaveBeenCalled();
  });

  it("the validator leaves the database alone unless the code is a test code from a trusted origin", async () => {
    await validator("PILOT");
    expect(h.getByKey).toHaveBeenCalledTimes(1);
    h.getByKey.mockClear();
    await validator("SOMETHING_ELSE");
    expect(h.getByKey).not.toHaveBeenCalled();
  });

  it("the validator is rate-limited like the other public probes", async () => {
    h.rateLimit.mockResolvedValue({ success: false });
    const v = await validator("PILOT");
    expect(v.status).toBe(429);
    expect(v.body).toEqual({ error: "Too many requests" });
    expect(h.getByKey).not.toHaveBeenCalled();
    expect(h.rateLimit).toHaveBeenCalledWith("promo:203.0.113.7");
  });
});

describe("with PROMO_CODES unset, nothing is a promo code", () => {
  beforeEach(() => vi.stubEnv("PROMO_CODES", ""));

  it.each(["FREE134", "TPFP", "FREE676", "TEST", "SMOKE"])("%s", async (code) => {
    expect((await validator(code)).body).toEqual({ valid: false, kind: null });
    expect((await charger(code)).body).toMatchObject({ url: "https://stripe.test/session" });
  });
});

describe("the hardcoded lists are gone", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("the validator route consults lib/orders/promo and names no code", () => {
    const src = read("app/api/checkout/validate-promo/route.ts");
    expect(src).toContain('from "@/lib/orders/promo"');
    expect(src).toContain("promoDecision(");
    for (const literal of ['"FREE134"', '"TPFP"', '"FREE676"', '"TEST"']) {
      expect(src, literal).not.toContain(literal);
    }
  });

  it("every reader of the admin switch names it through the shared constant", () => {
    for (const file of [
      "app/api/checkout/validate-promo/route.ts",
      "app/api/admin/test-promo/route.ts",
      "lib/checkout/createCheckoutSession.ts",
    ]) {
      const src = read(file);
      expect(src, file).toContain("TEST_PROMO_SWITCH_KEY");
      expect(src, file).not.toContain('"test_promo_code"');
    }
  });

  it("the charger's test branch uses the same decision", () => {
    const src = read("lib/checkout/createCheckoutSession.ts");
    expect(src).toContain("promoDecision(input.promoCode");
    expect(src).toContain("isTrustedPromoOrigin(request)");
    expect(src).not.toContain('promo_code: "TEST"');
  });

  it("pricing no longer carries a promo table", () => {
    expect(read("lib/orders/pricing.ts")).not.toMatch(/PROMO_CODES/);
  });

  it("the checkout pages take the code's kind from the validator instead of its spelling", () => {
    for (const page of ["app/will/checkout/page.tsx", "app/trust/checkout/page.tsx"]) {
      const src = read(page);
      expect(src, page).not.toContain('code === "TEST"');
      expect(src, page).toContain('data.kind === "test"');
    }
  });
});
