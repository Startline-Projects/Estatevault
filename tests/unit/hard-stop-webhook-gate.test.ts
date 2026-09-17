/**
 * Core Rule 4 at the API boundary — the webhook gate.
 *
 * The Stripe webhook is the last checkpoint before document rows exist. It
 * re-derives the hard stop from whatever intake it can find: the quiz session's
 * answers, or — once the E2EE purge has blanked those — orders.intake_data.
 * Both are the checkout's Zod-parsed intake written back to the database, so a
 * trigger the schema strips is invisible here too. These tests parse the
 * intake through the real schema first, then feed it to the webhook by each
 * route, for every trigger, on both products.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { willCheckoutSchema, trustCheckoutSchema } from "@/lib/validation/schemas";
import { VALID_WILL_INTAKE, VALID_TRUST_INTAKE, HARD_STOP_TRIGGERS } from "../fixtures/intake";

const h = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  insertMany: vi.fn(),
  getLatestAnswers: vi.fn(),
  addJob: vi.fn(),
}));

vi.mock("@/lib/stripe-payouts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/stripe-payouts")>();
  return {
    calculateSplit: actual.calculateSplit,
    transferToPartner: vi.fn(),
    transferToAffiliate: vi.fn(),
    getAccountStatus: vi.fn().mockResolvedValue({ transfers_active: true }),
  };
});
vi.mock("@/lib/config/appUrl", () => ({ getAppUrl: () => "http://test.local" }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("@/lib/queue/document-queue", () => ({
  addJob: (...a: unknown[]) => h.addJob(...a),
  isQueueConfigured: false,
}));
vi.mock("@/lib/repos/server/orderRepo", () => ({ update: (...a: unknown[]) => h.orderUpdate(...a) }));
vi.mock("@/lib/repos/server/partnerRepo", () => ({ getStripeAndTier: vi.fn() }));
vi.mock("@/lib/repos/server/payoutRepo", () => ({ insertPartnerPayout: vi.fn(), insertAffiliatePayout: vi.fn() }));
vi.mock("@/lib/repos/server/documentRepo", () => ({ insertMany: (...a: unknown[]) => h.insertMany(...a) }));
vi.mock("@/lib/repos/server/quizSessionRepo", () => ({
  getLatestAnswersByClient: (...a: unknown[]) => h.getLatestAnswers(...a),
}));
vi.mock("@/lib/repos/server/profileRepo", () => ({
  findIdAndNameByEmail: vi.fn(async () => ({ data: { id: "prof_1", full_name: "Buyer One" } })),
  findIdByEmailMaybe: vi.fn(async () => ({ data: { id: "prof_1" } })),
  upsert: vi.fn(),
}));
vi.mock("@/lib/repos/server/clientRepo", () => ({ setProfileId: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/repos/server/affiliateRepo", () => ({ getStripeAccountById: vi.fn(), incrementStats: vi.fn() }));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: vi.fn() }));

import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

/**
 * Chainable supabase stub. Everything resolves empty (a fresh, first-time
 * order) except the `orders` row, which carries whatever intake_data the test
 * wants the webhook to find.
 */
function makeAdmin(order: { status: string; intake_data: unknown } | null) {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const same = () => b;
    b.select = same; b.eq = same; b.in = same; b.contains = same; b.update = same;
    b.maybeSingle = () => Promise.resolve({ data: table === "orders" ? order : null });
    b.single = () => Promise.resolve({ data: null });
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [] });
    return b;
  };
  return { from: (t: string) => builder(t) } as never;
}

const session = {
  id: "cs_gate_1",
  amount_total: 40000,
  payment_intent: "pi_gate_1",
  customer_details: { email: "buyer@example.test", name: "Buyer One" },
} as never;

const meta = (product: "will" | "trust") => ({
  order_id: "order_1",
  client_id: "client_1",
  product_type: product,
  attorney_review: "false",
});

beforeEach(() => {
  vi.clearAllMocks();
  h.insertMany.mockResolvedValue({ error: null });
  h.orderUpdate.mockResolvedValue({ data: null, error: null });
});

const PRODUCTS = [
  { product: "will" as const, schema: willCheckoutSchema, intake: VALID_WILL_INTAKE },
  { product: "trust" as const, schema: trustCheckoutSchema, intake: VALID_TRUST_INTAKE },
];

function parsedWith(schema: typeof willCheckoutSchema | typeof trustCheckoutSchema, intake: object, field: string) {
  return schema.parse({ intakeAnswers: { ...intake, [field]: "Yes" } }).intakeAnswers as Record<string, unknown>;
}

function expectParked() {
  expect(h.orderUpdate).toHaveBeenCalledWith(expect.anything(), "order_1", { status: "needs_attorney" });
  expect(h.insertMany).not.toHaveBeenCalled();
  expect(h.addJob).not.toHaveBeenCalled();
}

describe.each(PRODUCTS)("$product webhook parks the order on every trigger", ({ product, schema, intake }) => {
  it.each(HARD_STOP_TRIGGERS)("$name — read back from the quiz session", async ({ field }) => {
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: parsedWith(schema, intake, field) } });
    await handleDocumentCheckout(makeAdmin({ status: "pending", intake_data: null }), session, meta(product));
    expectParked();
  });

  it.each(HARD_STOP_TRIGGERS)("$name — read back from orders.intake_data after the quiz purge", async ({ field }) => {
    // The E2EE purge blanks quiz answers to {}, which is when intake_data is consulted.
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: {} } });
    await handleDocumentCheckout(
      makeAdmin({ status: "pending", intake_data: parsedWith(schema, intake, field) }),
      session,
      meta(product),
    );
    expectParked();
  });

  it("a clean intake creates the document rows", async () => {
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: {} } });
    const clean = schema.parse({ intakeAnswers: intake }).intakeAnswers;
    await handleDocumentCheckout(makeAdmin({ status: "pending", intake_data: clean }), session, meta(product));
    expect(h.insertMany).toHaveBeenCalledTimes(1);
    expect(h.orderUpdate).not.toHaveBeenCalledWith(expect.anything(), "order_1", { status: "needs_attorney" });
  });
});
