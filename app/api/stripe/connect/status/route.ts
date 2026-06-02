import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await auth.admin
    .from("partners")
    .select("stripe_account_id")
    .eq("profile_id", auth.user.id)
    .single();
  if (!partner?.stripe_account_id) return ok({ connected: false });

  try {
    const account = await stripe.accounts.retrieve(partner.stripe_account_id);
    const ready = account.details_submitted && account.charges_enabled;
    return ok({ connected: true, ready, account_id: partner.stripe_account_id });
  } catch {
    return ok({ connected: false });
  }
});
