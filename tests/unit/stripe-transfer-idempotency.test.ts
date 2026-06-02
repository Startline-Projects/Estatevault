import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Stripe client so we can assert the idempotencyKey option (C-1).
const { createTransfer } = vi.hoisted(() => ({
  createTransfer: vi.fn().mockResolvedValue({ id: "tr_123" }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { transfers: { create: createTransfer } },
}));

import {
  transferToPartner,
  transferToAffiliate,
  transferToAffiliateBatch,
} from "@/lib/stripe-payouts";

describe("Stripe transfer idempotency (C-1)", () => {
  beforeEach(() => createTransfer.mockClear());

  it("partner transfer passes a stable per-order idempotency key", async () => {
    await transferToPartner("acct_1", 30000, "order-A", "partner-1", "will");
    const [, opts] = createTransfer.mock.calls[0];
    expect(opts).toEqual({ idempotencyKey: "transfer_partner_order-A" });
  });

  it("affiliate transfer key is role-distinct from the partner key for the same order", async () => {
    await transferToAffiliate("acct_2", 10000, "order-A", "aff-1", "will");
    const [, opts] = createTransfer.mock.calls[0];
    expect(opts).toEqual({ idempotencyKey: "transfer_affiliate_order-A" });
  });

  it("batch transfer uses the caller-supplied key when given", async () => {
    await transferToAffiliateBatch("acct_3", 5000, "aff-1", ["o1", "o2"], "batch-key-xyz");
    const [, opts] = createTransfer.mock.calls[0];
    expect(opts).toEqual({ idempotencyKey: "batch-key-xyz" });
  });

  it("batch transfer falls back to a deterministic key from the order set", async () => {
    await transferToAffiliateBatch("acct_3", 5000, "aff-1", ["o2", "o1"]);
    const [, opts] = createTransfer.mock.calls[0];
    // order-independent (sorted)
    expect(opts).toEqual({ idempotencyKey: "transfer_affiliate_batch_aff-1_o1-o2" });
  });
});
