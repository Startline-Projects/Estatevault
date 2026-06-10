import { describe, it, expect } from "vitest";
import { resubscribeDecision } from "@/lib/repos/server/clientRepo";

const SUB = "sub_live_123";

describe("resubscribeDecision — BUG-14 (no second subscription while one is live)", () => {
  it("active subscription blocks a duplicate subscribe", () => {
    expect(resubscribeDecision("active", SUB)).toBe("block");
    expect(resubscribeDecision("active", null)).toBe("block");
  });

  it("cancel-pending (cancelled + live Stripe id) reactivates the existing sub", () => {
    // cancel_at_period_end is on but the sub is still live — resume it, don't
    // create a second one (would double-bill and orphan the first).
    expect(resubscribeDecision("cancelled", SUB)).toBe("reactivate");
  });

  it("past_due with a live Stripe id does not create a new sub", () => {
    expect(resubscribeDecision("past_due", SUB)).toBe("past_due");
  });

  it("fully lapsed (no live Stripe id) creates a fresh checkout", () => {
    // customer.subscription.deleted clears the Stripe id at period end.
    expect(resubscribeDecision("cancelled", null)).toBe("create");
    expect(resubscribeDecision("past_due", null)).toBe("create");
  });

  it("never subscribed (no status, no id) creates a fresh checkout", () => {
    expect(resubscribeDecision(null, null)).toBe("create");
    expect(resubscribeDecision(undefined, undefined)).toBe("create");
    expect(resubscribeDecision("none", null)).toBe("create");
  });

  it("an unknown status with a live id still reactivates rather than duplicating", () => {
    expect(resubscribeDecision("trialing", SUB)).toBe("reactivate");
  });
});
