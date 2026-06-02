import { NextRequest } from "next/server";
import { stripeConnectOnboardSchema } from "@/lib/validation/schemas";
import { stripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { getAppUrl } from "@/lib/config/appUrl";

export const POST = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(undefined, request);
  if ("error" in auth) return auth.error;

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, stripe_account_id")
    .eq("profile_id", auth.user.id)
    .single();
  if (!partner) return fail("Partner not found", 404);

  const origin = request.headers.get("origin") || getAppUrl();
  const rawBody = await request.json().catch(() => ({}));
  const bodyParsed = stripeConnectOnboardSchema.safeParse(rawBody);
  const returnPath: string = bodyParsed.success ? (bodyParsed.data.returnPath ?? "/pro/settings") : "/pro/settings";

  let accountId = partner.stripe_account_id;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
      });
      accountId = account.id;
      await auth.admin.from("partners").update({ stripe_account_id: accountId }).eq("id", partner.id);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}${returnPath}?stripe_connect=refresh`,
      return_url: `${origin}${returnPath}?stripe_connect=success`,
      type: "account_onboarding",
    });

    return ok({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe Connect onboard error:", err);
    return fail("Could not start Stripe onboarding", 500);
  }
});
