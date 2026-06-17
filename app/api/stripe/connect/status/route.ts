import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { retryPendingPartnerPayouts } from "@/lib/payouts/retryPendingPartnerPayouts";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, stripe_account_id")
    .eq("profile_id", auth.user.id)
    .single();
  if (!partner?.stripe_account_id) return ok({ connected: false });

  try {
    const account = await stripe.accounts.retrieve(partner.stripe_account_id);
    const ready = account.details_submitted && account.charges_enabled;

    // Fallback resolver for stuck `pending` payouts (BUG-15): the account.updated
    // webhook is the primary trigger, but it depends on Connect events being
    // enabled on the endpoint. Whenever onboarding looks done, opportunistically
    // drain the IOUs here too. retryPendingPartnerPayouts re-checks the transfers
    // capability and is idempotent, so it is a no-op when there is nothing owed.
    if (ready) {
      try {
        await retryPendingPartnerPayouts(auth.admin, partner.id);
      } catch (retryError) {
        console.error("connect/status: pending payout retry failed:", retryError);
      }
    }

    return ok({ connected: true, ready, account_id: partner.stripe_account_id });
  } catch {
    return ok({ connected: false });
  }
});
