import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminCommissionMarkPaidSchema } from "@/lib/validation/schemas";
import * as commissionPayoutRepo from "@/lib/repos/server/commissionPayoutRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

// Admin-only: record that a recipient's (sales rep / review attorney) commission
// for a period has been paid out by hand (ACH / check / payroll). This is the
// source of truth for the "Paid" status on the commission pages. Idempotent via
// the unique (recipient_id, period) index — a duplicate mark-paid is a no-op.

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"], req);
  if ("error" in auth) return auth.error;

  const parsed = adminCommissionMarkPaidSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);
  const { recipientId, period, amountCents, method, note } = parsed.data;

  const { data: inserted, error } = await commissionPayoutRepo.markPaid(auth.admin, {
    recipient_id: recipientId,
    period,
    amount_cents: amountCents,
    status: "paid",
    method: method ?? null,
    note: note ?? null,
    created_by: auth.user.id,
  });
  if (error) return fail("Failed to record payout", 500);

  // inserted === null means this recipient+period was already marked paid.
  const alreadyPaid = !inserted;
  if (!alreadyPaid) {
    await auditLogRepo.insertEntry(auth.admin, {
      actor_id: auth.user.id,
      action: "commission.marked_paid",
      resource_type: "commission_payout",
      resource_id: recipientId,
      metadata: { period, amount_cents: amountCents, method: method ?? null },
    });
  }

  return ok({ success: true, alreadyPaid });
});
