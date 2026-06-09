import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import { vaultSubscriptionCheckoutSchema } from "@/lib/validation/schemas";
import { PRICES } from "@/lib/orders/pricing";

export const POST = withRoute(async (request: Request) => {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = vaultSubscriptionCheckoutSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const partnerSlug = parsed.data.partner_slug;
    const guestEmail = parsed.data.email;
    const guestName = parsed.data.full_name;

    const supabase = createAdminClient();
    const origin = request.headers.get("origin") || "https://www.estatevault.us";

    // Resolve partner
    let partnerId: string | null = null;
    let partnerStripeAccountId: string | null = null;
    let partnerRevenuePct = 0;
    if (partnerSlug) {
      const { data: partner } = await partnerRepo.findStripeInfoBySlug(supabase, partnerSlug);
      partnerId = partner?.id ?? null;
      partnerStripeAccountId = partner?.stripe_account_id ?? null;
      partnerRevenuePct = partner?.partner_revenue_pct ?? 0;
    }

    // Try to get authenticated user when needed.
    // In partner vault signup we already pass guest email, so session lookup is optional.
    let user: { id: string; email?: string } | null = null;
    if (!guestEmail) {
      const authClient = createClient();
      const { data } = await authClient.auth.getUser();
      user = data.user;
    }

    let clientId: string | null = null;
    let customerEmail = guestEmail || user?.email;
    // When the user is resubscribing while a cancelled term is still paid, stack
    // the new year on top: start billing when the current access ends so they
    // aren't double-charged and lose no remaining days.
    let existingExpiry: string | null = null;

    // For partner vault checkout we may receive guest details before a stable
    // browser session exists. Ensure auth/profile/client are created up front
    // so post-payment PIN setup can always map to a real user account.
    if (guestEmail) {
      const normalizedGuestEmail = guestEmail.trim().toLowerCase();
      customerEmail = normalizedGuestEmail;

      let profileId: string | null = null;
      const { data: existingProfile } = await profileRepo.findIdByEmailMaybe(supabase, normalizedGuestEmail);

      if (existingProfile?.id) {
        profileId = existingProfile.id;
      } else {
        const { data: authMatch } = await supabase.rpc("find_auth_user_by_email", { lookup_email: normalizedGuestEmail }).returns<{ id: string; email: string }[]>().maybeSingle();

        if (authMatch) {
          profileId = authMatch.id;
        } else {
          const { data: createdUser, error: createUserErr } = await supabase.auth.admin.createUser({
            email: normalizedGuestEmail,
            email_confirm: true,
            user_metadata: { full_name: (guestName || "").trim(), user_type: "client" },
          });

          if (createUserErr || !createdUser?.user?.id) {
            return NextResponse.json(
              { error: "Unable to prepare account for checkout." },
              { status: 500 }
            );
          }
          profileId = createdUser.user.id;
        }

        if (profileId) {
          await profileRepo.upsert(supabase, {
            id: profileId,
            email: normalizedGuestEmail,
            full_name: (guestName || "").trim() || null,
            user_type: "client",
          });
        }
      }

      if (profileId) {
        const { data: existingClient } = await clientRepo.findIdAndSubByProfileMaybe(supabase, profileId);

        if (existingClient?.vault_subscription_status === "active") {
          return NextResponse.json({ error: "Already subscribed" }, { status: 400 });
        }

        if (existingClient?.id) {
          clientId = existingClient.id;
          existingExpiry = existingClient.vault_subscription_expiry;
        } else {
          const { data: createdClient } = await clientRepo.create(supabase, {
            profile_id: profileId,
            partner_id: partnerId,
            source: partnerId ? "partner" : "direct",
          });

          clientId = createdClient?.id ?? null;
        }
      }
    }

    if (user && !clientId) {
      // Authenticated: get or create client record
      let { data: client } = await clientRepo.findIdAndSubByProfile(supabase, user.id);

      if (!client) {
        const { data: newClient } = await clientRepo.createReturningWithSub(supabase, {
          profile_id: user.id,
          partner_id: partnerId,
          source: partnerId ? "partner" : "direct",
        });
        client = newClient;
      }

      if (client?.vault_subscription_status === "active") {
        return NextResponse.json({ error: "Already subscribed" }, { status: 400 });
      }

      clientId = client?.id ?? null;
      existingExpiry = client?.vault_subscription_expiry ?? null;
    }

    const successPath = partnerSlug
      ? `/auth/vault-pin?partner=${partnerSlug}`
      : "/dashboard/vault?subscribed=true";

    const cancelPath = partnerSlug
      ? `/${partnerSlug}/vault`
      : "/dashboard/vault";

    // Stack a resubscribe onto remaining paid time: defer the first charge until
    // the current access ends (Stripe `trial_end`), so billing — and the new
    // 12-month term — begin exactly when the old one would have lapsed.
    const expiryMs = existingExpiry ? new Date(existingExpiry).getTime() : 0;
    const trialEnd = expiryMs > Date.now() ? Math.floor(expiryMs / 1000) : null;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {};
    if (partnerStripeAccountId && partnerRevenuePct > 0) {
      subscriptionData.application_fee_percent = 100 - partnerRevenuePct;
      subscriptionData.transfer_data = { destination: partnerStripeAccountId };
    }
    if (trialEnd) subscriptionData.trial_end = trialEnd;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: customerEmail || undefined,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "EstateVault Vault Plan",
            description: "Annual vault subscription — secure document storage, farewell messages, trustee access",
          },
          unit_amount: PRICES.vaultSubscriptionYear,
          recurring: { interval: "year" },
        },
        quantity: 1,
      }],
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      ...(Object.keys(subscriptionData).length > 0 ? { subscription_data: subscriptionData } : {}),
      metadata: {
        product_type: "vault_subscription",
        ...(clientId && { client_id: clientId }),
        ...(user?.id && { user_id: user.id }),
        ...(partnerId && { partner_id: partnerId }),
        ...(partnerSlug && { partner_slug: partnerSlug }),
        ...(guestEmail && { guest_email: guestEmail }),
        ...(guestName && { guest_name: guestName }),
      },
    });

    if (user && clientId) {
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        action: "subscription.checkout_started",
        resource_type: "client",
        resource_id: clientId,
        metadata: { session_id: session.id },
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Vault subscription checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
});
