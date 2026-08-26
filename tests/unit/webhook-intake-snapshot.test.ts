// A Stripe webhook replay after the E2EE purge must not destroy the order's
// intake snapshot.
//
// The E2EE purge blanks quiz_sessions.answers to {} once documents are
// generated, but leaves the row in place. The handler re-read that row and
// overwrote orders.intake_data with it — so a redelivery, a reconcile-cron
// re-dispatch, or an admin retry replaced the full intake captured at checkout
// with {} or { email }. That snapshot is the only copy left after the purge, so
// losing it breaks regeneration.
//
// The same emptiness bug silently skipped the Core Rule 4 hard stop: `??` does
// not fall through on {}, so evaluateHardStop received an empty object and
// reported "not halted".

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  getStripeAndTier: vi.fn(),
  transferToPartner: vi.fn(),
  insertPartnerPayout: vi.fn(),
  insertMany: vi.fn(),
  getLatestAnswers: vi.fn(),
  audit: vi.fn(),
  addJob: vi.fn(),
  alert: vi.fn(),
}));

vi.mock("@/lib/stripe-payouts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/stripe-payouts")>();
  return {
    calculateSplit: actual.calculateSplit,
    transferToPartner: (...a: unknown[]) => h.transferToPartner(...a),
    transferToAffiliate: vi.fn(),
  };
});
vi.mock("@/lib/config/appUrl", () => ({ getAppUrl: () => "http://test.local" }));
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn(),
  sendFulfillmentFailureAlert: (...a: unknown[]) => h.alert(...a),
}));
vi.mock("@/lib/queue/document-queue", () => ({
  addJob: (...a: unknown[]) => h.addJob(...a),
  isQueueConfigured: false,
}));
vi.mock("@/lib/repos/server/orderRepo", () => ({ update: (...a: unknown[]) => h.orderUpdate(...a) }));
vi.mock("@/lib/repos/server/partnerRepo", () => ({ getStripeAndTier: (...a: unknown[]) => h.getStripeAndTier(...a) }));
vi.mock("@/lib/repos/server/payoutRepo", () => ({
  insertPartnerPayout: (...a: unknown[]) => h.insertPartnerPayout(...a),
  insertAffiliatePayout: vi.fn(),
}));
vi.mock("@/lib/repos/server/documentRepo", () => ({ insertMany: (...a: unknown[]) => h.insertMany(...a) }));
vi.mock("@/lib/repos/server/quizSessionRepo", () => ({ getLatestAnswersByClient: (...a: unknown[]) => h.getLatestAnswers(...a) }));
vi.mock("@/lib/repos/server/profileRepo", () => ({
  findIdAndNameByEmail: vi.fn(async () => ({ data: { id: "prof_1", full_name: "Buyer One" } })),
  findIdByEmailMaybe: vi.fn(async () => ({ data: { id: "prof_1" } })),
  upsert: vi.fn(),
}));
vi.mock("@/lib/repos/server/clientRepo", () => ({ setProfileId: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/repos/server/affiliateRepo", () => ({ getStripeAccountById: vi.fn(), incrementStats: vi.fn() }));
vi.mock("@/lib/repos/server/auditLogRepo", () => ({ insertEntry: (...a: unknown[]) => h.audit(...a) }));

import { handleDocumentCheckout } from "@/lib/webhooks/stripe/handleDocumentCheckout";

/** The full intake captured at checkout, before any purge. */
const CHECKOUT_SNAPSHOT = {
  firstName: "Ahmed",
  lastName: "Hassan",
  city: "Dearborn",
  state: "Michigan",
  executorName: "Raga Hassan",
  beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "100" }],
  hasSpecialNeedsDependent: "No",
};

function makeAdmin(state: { orderStatus?: string | null; intakeData?: Record<string, unknown> | null }) {
  const tableReads: Record<string, unknown> = {
    orders: { data: { status: state.orderStatus ?? null, intake_data: state.intakeData ?? null } },
    documents: { data: [] },
    payouts: { data: null },
    affiliate_payouts: { data: null },
    attorney_reviews: { data: null },
  };
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.contains = chain;
    builder.update = () => ({ eq: vi.fn(() => Promise.resolve({})) });
    builder.single = () => Promise.resolve(tableReads[table] ?? { data: null });
    builder.maybeSingle = () => Promise.resolve(tableReads[table] ?? { data: null });
    builder.then = (resolve: (v: unknown) => unknown) => resolve(tableReads[table] ?? { data: [] });
    return builder;
  });
  return { admin: { from } as never };
}

const session = () => ({
  id: "cs_1",
  amount_total: 40000,
  payment_intent: "pi_1",
  customer_details: { email: "buyer@example.test", name: "Buyer One" },
}) as never;

const meta = () => ({
  order_id: "order_1",
  client_id: "client_1",
  product_type: "will",
  attorney_review: "false",
}) as Record<string, string>;

/** Every intake_data value the handler tried to write. */
function intakeWrites() {
  return h.orderUpdate.mock.calls
    .map((c) => c[2] as Record<string, unknown> | undefined)
    .filter((payload) => payload && "intake_data" in payload)
    .map((payload) => payload!.intake_data);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.transferToPartner.mockResolvedValue({ id: "tr_1" });
  h.insertMany.mockResolvedValue({ error: null });
});

describe("replay after the E2EE purge", () => {
  it("does not overwrite the order snapshot with purged answers", async () => {
    // The purge leaves the row present with answers = {}.
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: {} } });
    const { admin } = makeAdmin({ orderStatus: "generating", intakeData: CHECKOUT_SNAPSHOT });

    await handleDocumentCheckout(admin, session(), meta());

    expect(intakeWrites()).toEqual([]);
  });

  it("does not re-point quiz_session_id at the purged session", async () => {
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_purged", answers: {} } });
    const { admin } = makeAdmin({ orderStatus: "generating", intakeData: CHECKOUT_SNAPSHOT });

    await handleDocumentCheckout(admin, session(), meta());

    const repointed = h.orderUpdate.mock.calls.some(
      (c) => (c[2] as Record<string, unknown>)?.quiz_session_id !== undefined,
    );
    expect(repointed).toBe(false);
  });

  it("still advances the order, so a replay is not a no-op", async () => {
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: {} } });
    const { admin } = makeAdmin({ orderStatus: "pending", intakeData: CHECKOUT_SNAPSHOT });

    await handleDocumentCheckout(admin, session(), meta());

    const advanced = h.orderUpdate.mock.calls.some(
      (c) => (c[2] as Record<string, unknown>)?.status === "generating",
    );
    expect(advanced).toBe(true);
  });

  it("re-checks the Core Rule 4 hard stop against the surviving snapshot", async () => {
    // Purged answers used to short-circuit the fallback, so a halted order
    // sailed through. The snapshot says special-needs dependent.
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: {} } });
    const { admin } = makeAdmin({
      orderStatus: "pending",
      intakeData: { ...CHECKOUT_SNAPSHOT, hasSpecialNeedsDependent: "Yes" },
    });

    await handleDocumentCheckout(admin, session(), meta());

    const parked = h.orderUpdate.mock.calls.some(
      (c) => (c[2] as Record<string, unknown>)?.status === "needs_attorney",
    );
    expect(parked).toBe(true);
    // Halting must happen before any document rows are created.
    expect(h.insertMany).not.toHaveBeenCalled();
  });
});

describe("first delivery, nothing purged yet", () => {
  it("still writes the snapshot when the answers hold something", async () => {
    h.getLatestAnswers.mockResolvedValue({ data: { id: "quiz_1", answers: CHECKOUT_SNAPSHOT } });
    const { admin } = makeAdmin({ orderStatus: "pending", intakeData: null });

    await handleDocumentCheckout(admin, session(), meta());

    const written = intakeWrites();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ firstName: "Ahmed", email: "buyer@example.test" });
  });
});
