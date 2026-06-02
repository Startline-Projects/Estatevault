import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { getAppUrl } from "@/lib/config/appUrl";
import {
  createStripeConnectAccount,
  createAccountLink,
  getAccountStatus,
} from "@/lib/stripe-payouts";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getStripeByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("Partner profile not found", 404);

  // Partner portal: prefer the request origin (pro.estatevault.com), else the
  // configured app URL.
  const baseUrl = req.headers.get("origin") || getAppUrl();

  if (partner.stripe_account_id) {
    const accountLink = await createAccountLink(partner.stripe_account_id, baseUrl);
    return ok({ url: accountLink.url, account_id: partner.stripe_account_id });
  }

  const email = partner.sender_email || auth.user.email || "";
  const account = await createStripeConnectAccount(email, partner.id);

  const { error: updateError } = await partnerRepo.update(auth.admin, partner.id, {
    stripe_account_id: account.id,
  });
  if (updateError) return fail("Failed to save Stripe account", 500);

  const accountLink = await createAccountLink(account.id, baseUrl);
  return ok({ url: accountLink.url, account_id: account.id });
});

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getStripeByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("Partner profile not found", 404);

  if (!partner.stripe_account_id) {
    return ok({ connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false });
  }

  const status = await getAccountStatus(partner.stripe_account_id);
  return ok({ connected: true, ...status });
});
