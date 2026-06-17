// Clear a partner's stuck `pending` payouts once their Stripe Connect account
// can finally receive transfers.
//
// Background (BUG-15): at checkout, a partner cut we cannot transfer yet (no
// Connect account, or the `transfers` capability not active) is recorded as a
// `pending` payout IOU instead of being dropped. Nothing used to ever resolve
// those rows, so they sat pending forever even after the partner finished
// Stripe onboarding. This service is that missing resolver: it is triggered
// when the account becomes payable (the account.updated webhook) and as a
// fallback whenever Connect status is checked.
//
// Idempotency: each transfer is keyed on the ORDER id (transferToPartner uses
// `transfer_partner_<orderId>`), the same key the checkout path uses. So two
// concurrent triggers — and even a stray duplicate payout row for the same
// order — collapse to ONE Stripe transfer; the conditional `markPayoutSent`
// then flips only the still-pending row. Money is never sent twice.

import type { createAdminClient } from "@/lib/api/auth";
import { getAccountStatus, transferToPartner } from "@/lib/stripe-payouts";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

type Admin = ReturnType<typeof createAdminClient>;

export async function retryPendingPartnerPayouts(
  admin: Admin,
  partnerId: string,
): Promise<{ cleared: number; total: number }> {
  const { data: partner } = await partnerRepo.getStripeAndTier(admin, partnerId);
  if (!partner?.stripe_account_id) return { cleared: 0, total: 0 };

  // Only attempt once the connected account can actually RECEIVE a transfer —
  // details_submitted / payouts_enabled can be true while transfers is still
  // pending review (BUG-15). Gate on the transfers capability.
  let transfersActive = false;
  try {
    transfersActive = (await getAccountStatus(partner.stripe_account_id)).transfers_active;
  } catch (statusError) {
    console.error("retryPendingPartnerPayouts: account status check failed:", statusError);
    return { cleared: 0, total: 0 };
  }
  if (!transfersActive) return { cleared: 0, total: 0 };

  const { data: pending } = await payoutRepo.listPendingByPartner(admin, partnerId);
  const rows = pending || [];
  let cleared = 0;

  for (const row of rows) {
    const orderId =
      row.order_id ??
      (Array.isArray(row.orders_included) ? (row.orders_included as string[])[0] : null);
    if (!orderId || !row.amount || row.amount <= 0) continue;
    try {
      const transfer = await transferToPartner(
        partner.stripe_account_id,
        row.amount,
        orderId,
        partnerId,
        "pending_retry",
      );
      if (!transfer) continue;

      const { data: updated } = await payoutRepo.markPayoutSent(admin, row.id, transfer.id);
      // Null = a racing trigger already flipped this row; the Stripe idempotency
      // key meant no second transfer happened, so just skip the duplicate audit.
      if (!updated) continue;

      cleared++;
      await auditLogRepo.insertEntry(admin, {
        action: "payout.sent",
        resource_type: "payout",
        resource_id: row.id,
        metadata: {
          partner_id: partnerId,
          amount: row.amount,
          transfer_id: transfer.id,
          order_id: orderId,
          retried: true,
        },
      });
    } catch (transferError) {
      // Leave the row pending; the next trigger retries it. Never throw — one
      // bad row must not abort the others or fail the calling webhook/route.
      console.error(`retryPendingPartnerPayouts: transfer failed for payout ${row.id}:`, transferError);
    }
  }

  return { cleared, total: rows.length };
}
