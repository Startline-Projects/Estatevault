export const dynamic = "force-dynamic";

import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { sendWelcomeEmail, sendDunningEmail } from "@/lib/email";
import { calculateSplit, transferToPartner, transferToAffiliate } from "@/lib/stripe-payouts";
import * as stripeWebhookRepo from "@/lib/repos/server/stripeWebhookRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as documentRepo from "@/lib/repos/server/documentRepo";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";
import * as affiliateRepo from "@/lib/repos/server/affiliateRepo";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const POST = withRoute(async (request: NextRequest) => {
  const body = await request.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return fail("Missing stripe-signature header", 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return fail("Webhook signature verification failed", 400);
  }

  const supabase = createAdminClient();

  // ── IDEMPOTENCY GUARD ──────────────────────────────────────
  const { data: inserted } = await stripeWebhookRepo.checkIdempotency(
    supabase,
    event.id,
    event.type,
  );
  if (!inserted) {
    return ok({ received: true, duplicate: true });
  }

  // ── VAULT SUBSCRIPTION EVENTS ───────────────────────────────
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason === "subscription_cycle") {
      const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | null;
      if (subscriptionId) {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        await clientRepo.activateVaultByStripeId(supabase, subscriptionId, expiry.toISOString());
        await auditLogRepo.insertEntry(supabase, {
          action: "subscription.renewed",
          resource_type: "client",
          resource_id: subscriptionId,
          metadata: { subscription_id: subscriptionId },
        });
      }
    }
    return ok({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | null;
    if (subscriptionId) {
      const { data: client } = await clientRepo.findBySubscriptionId(supabase, subscriptionId);
      if (client) {
        await clientRepo.updateVaultSubscription(supabase, client.id, {
          vault_subscription_status: "past_due",
        });
        try {
          const { data: profile } = await profileRepo.getEmailAndNameById(supabase, client.profile_id);
          if (profile?.email) {
            await sendDunningEmail({ to: profile.email, fullName: profile.full_name });
          }
        } catch (emailErr) {
          console.error("Dunning email failed:", emailErr);
        }
        await auditLogRepo.insertEntry(supabase, {
          action: "subscription.payment_failed",
          resource_type: "client",
          resource_id: client.id,
        });
      }
    }
    return ok({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await clientRepo.cancelVaultByStripeId(supabase, subscription.id);
    await auditLogRepo.insertEntry(supabase, {
      action: "subscription.deleted",
      resource_type: "client",
      resource_id: subscription.id,
      metadata: { subscription_id: subscription.id },
    });
    return ok({ received: true });
  }

  // ── CHECKOUT SESSION COMPLETED ──────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Handle partner platform fee checkout
    if (metadata.type === "partner_platform_fee") {
      const partnerId = metadata.partner_id;
      if (partnerId) {
        await partnerRepo.update(supabase, partnerId, {
          one_time_fee_paid: true,
          onboarding_step: 2,
          platform_fee_amount: session.amount_total || 0,
        });
        await auditLogRepo.insertEntry(supabase, {
          action: "partner.platform_fee_paid",
          resource_type: "partner",
          resource_id: partnerId,
          metadata: { tier: metadata.tier, amount: session.amount_total },
        });
      } else {
        console.error("partner_platform_fee webhook received without partner_id in metadata");
      }
      return ok({ received: true });
    }

    // Handle vault subscription checkout
    if (metadata.product_type === "vault_subscription") {
      await handleVaultSubscriptionCheckout(supabase, session, metadata);
      return ok({ received: true });
    }

    // Handle will/trust checkout
    await handleDocumentCheckout(supabase, session, metadata);
  }

  return ok({ received: true });
});

// ── VAULT SUBSCRIPTION CHECKOUT ─────────────────────────────
async function handleVaultSubscriptionCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const partnerId = metadata.partner_id || null;

  let clientId = metadata.client_id || null;

  if (!clientId) {
    clientId = await resolveOrCreateGuestClient(supabase, session, metadata, partnerId, "vault");
  }

  if (!clientId) return;

  await clientRepo.updateVaultSubscription(supabase, clientId, {
    vault_subscription_status: "active",
    vault_subscription_expiry: expiry.toISOString(),
    vault_subscription_stripe_id: subscriptionId,
  });
  await auditLogRepo.insertEntry(supabase, {
    action: "subscription.activated",
    resource_type: "client",
    resource_id: clientId,
    metadata: { subscription_id: subscriptionId },
  });

  const amountTotal = session.amount_total || 0;
  let partnerCut = 0;
  let evCut = amountTotal;
  let partnerStripeAccountId: string | null = null;

  if (partnerId) {
    const { data: partner } = await partnerRepo.getStripeAndRevenuePct(supabase, partnerId);
    const pct = Number(partner?.partner_revenue_pct) || 0;
    partnerCut = Math.round((amountTotal * pct) / 100);
    evCut = amountTotal - partnerCut;
    partnerStripeAccountId = partner?.stripe_account_id || null;
  }

  const willTransfer = !!(partnerId && partnerStripeAccountId && partnerCut > 0);
  const { data: vaultOrder } = await orderRepo.insert(supabase, {
    client_id: clientId,
    partner_id: partnerId,
    product_type: "vault_subscription",
    status: partnerId && partnerCut > 0 ? "paid" : "delivered",
    amount_total: amountTotal,
    partner_cut: partnerCut,
    ev_cut: evCut,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  if (vaultOrder && partnerId && partnerCut > 0 && !willTransfer) {
    await payoutRepo.insertPartnerPayout(supabase, {
      partner_id: partnerId,
      amount: partnerCut,
      status: "pending",
      orders_included: [vaultOrder.id],
    });
  }

  if (vaultOrder && partnerId && partnerStripeAccountId && partnerCut > 0) {
    try {
      const transfer = await transferToPartner(
        partnerStripeAccountId,
        partnerCut,
        vaultOrder.id,
        partnerId,
        "vault_subscription",
      );
      if (transfer) {
        await orderRepo.update(supabase, vaultOrder.id, {
          status: "delivered",
          transfer_id: transfer.id,
        });
        await payoutRepo.insertPartnerPayout(supabase, {
          partner_id: partnerId,
          amount: partnerCut,
          status: "sent",
          stripe_transfer_id: transfer.id,
          orders_included: [vaultOrder.id],
        });
        await auditLogRepo.insertEntry(supabase, {
          action: "payout.sent",
          resource_type: "payout",
          resource_id: vaultOrder.id,
          metadata: {
            partner_id: partnerId,
            amount: partnerCut,
            transfer_id: transfer.id,
            product_type: "vault_subscription",
          },
        });
      }
    } catch (err) {
      console.error("Vault subscription partner transfer failed:", err);
    }
  }
}

// ── DOCUMENT (WILL/TRUST) CHECKOUT ──────────────────────────
async function handleDocumentCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const orderId = metadata.order_id;
  const clientId = metadata.client_id;
  const productType = metadata.product_type as "will" | "trust";
  const attorneyReview = metadata.attorney_review === "true";
  const customerEmail = session.customer_details?.email;

  if (!orderId) {
    console.error("No order_id in session metadata");
    return;
  }

  // ── 1. Ensure user account exists ──────────────────────────
  let profileId: string | null = null;
  const clientFullName = metadata.client_name || session.customer_details?.name || "";

  if (customerEmail) {
    const { data: existingProfile } = await profileRepo.findIdAndNameByEmail(supabase, customerEmail)
      .then(r => r, () => ({ data: null }));

    if (existingProfile) {
      profileId = existingProfile.id;
      if (clientFullName && !existingProfile.full_name) {
        await supabase.from("profiles").update({ full_name: clientFullName }).eq("id", profileId);
      }
    } else {
      const { data: authMatch } = await supabase
        .rpc("find_auth_user_by_email", { lookup_email: customerEmail })
        .returns<{ id: string; email: string }[]>()
        .maybeSingle();

      if (authMatch) {
        await profileRepo.upsert(supabase, {
          id: authMatch.id,
          email: customerEmail,
          full_name: clientFullName || null,
          user_type: "client",
        });
        profileId = authMatch.id;
      } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: customerEmail,
          email_confirm: true,
          user_metadata: { user_type: "client", full_name: clientFullName },
        });

        if (createError || !newUser.user) {
          console.error("Failed to auto-create user:", createError);
        } else {
          profileId = newUser.user.id;

          const { data: profileCheck } = await profileRepo.findIdByEmailMaybe(supabase, customerEmail);
          if (!profileCheck) {
            await profileRepo.upsert(supabase, {
              id: profileId,
              email: customerEmail,
              full_name: clientFullName || null,
              user_type: "client",
            });
          } else if (clientFullName) {
            await supabase.from("profiles").update({ full_name: clientFullName }).eq("id", profileId);
          }

          const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
          await sendWelcomeEmail({
            to: customerEmail,
            fullName: clientFullName || null,
            productType,
            attorneyReview,
            loginLink: `${origin}/auth/login?email=${encodeURIComponent(customerEmail)}`,
            partnerId: metadata.partner_id || null,
          });
          await auditLogRepo.insertEntry(supabase, {
            action: "email.welcome_sent",
            resource_type: "profile",
            resource_id: profileId,
          });
        }
      }

      if (profileId && clientId) {
        const { data: clientRecord } = await supabase
          .from("clients")
          .select("id, profile_id")
          .eq("id", clientId)
          .single();

        if (clientRecord && !clientRecord.profile_id) {
          await clientRepo.setProfileId(supabase, clientId, profileId);
        } else if (!clientRecord) {
          await clientRepo.create(supabase, {
            id: clientId,
            profile_id: profileId,
            source: "direct",
            state: "Michigan",
          });
        }
      }
    }
  }

  // ── 2. Update order to generating ──────────────────────────
  const { data: quizForIntake } = await quizSessionRepo.getLatestAnswersByClient(supabase, clientId)
    .then(r => r, () => ({ data: null }));

  const updatePayload: Record<string, unknown> = {
    status: "generating",
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  };
  if (quizForIntake) {
    updatePayload.intake_data = quizForIntake.answers;
    updatePayload.quiz_session_id = quizForIntake.id;
  }
  await orderRepo.update(supabase, orderId, updatePayload);

  // ── 2b. Partner payout via Stripe Connect ──────────────────
  const partnerId = metadata.partner_id;
  if (partnerId) {
    try {
      const { data: partner } = await partnerRepo.getStripeAndTier(supabase, partnerId);

      if (partner?.stripe_account_id && partner.tier) {
        const { evCut, partnerCut } = calculateSplit(
          productType,
          partner.tier as "standard" | "enterprise",
        );

        if (partnerCut > 0) {
          const transfer = await transferToPartner(
            partner.stripe_account_id,
            partnerCut,
            orderId,
            partnerId,
            productType,
          );

          if (transfer) {
            await orderRepo.update(supabase, orderId, {
              ev_cut: evCut,
              partner_cut: partnerCut,
            });
            await payoutRepo.insertPartnerPayout(supabase, {
              partner_id: partnerId,
              amount: partnerCut,
              status: "sent",
              stripe_transfer_id: transfer.id,
              orders_included: [orderId],
            });
            await auditLogRepo.insertEntry(supabase, {
              action: "payout.sent",
              resource_type: "payout",
              resource_id: orderId,
              metadata: {
                partner_id: partnerId,
                amount: partnerCut,
                transfer_id: transfer.id,
              },
            });
          }
        }
      } else if (partnerId) {
        const { evCut, partnerCut } = calculateSplit(
          productType,
          (partner?.tier as "standard" | "enterprise") || "standard",
        );
        await orderRepo.update(supabase, orderId, { ev_cut: evCut, partner_cut: partnerCut });
        await payoutRepo.insertPartnerPayout(supabase, {
          partner_id: partnerId,
          amount: partnerCut,
          status: "pending",
          orders_included: [orderId],
        });
      }
    } catch (payoutError) {
      console.error("Partner payout failed:", payoutError);
    }
  }

  // ── 2c. Affiliate payout via Stripe Connect ────────────────
  const affiliateIdMeta = metadata.affiliate_id;
  if (affiliateIdMeta && !partnerId) {
    try {
      const { data: aff } = await affiliateRepo.getStripeAccountById(supabase, affiliateIdMeta);

      const { data: orderRow } = await supabase
        .from("orders")
        .select("affiliate_cut")
        .eq("id", orderId)
        .single();
      const affCut = orderRow?.affiliate_cut || 0;

      if (affCut > 0) {
        let transferId: string | null = null;
        let payoutStatus: "sent" | "pending" = "pending";

        if (aff?.stripe_account_id && aff.stripe_onboarding_complete) {
          const transfer = await transferToAffiliate(
            aff.stripe_account_id,
            affCut,
            orderId,
            affiliateIdMeta,
            productType,
          );
          if (transfer) {
            transferId = transfer.id;
            payoutStatus = "sent";
          }
        }

        await payoutRepo.insertAffiliatePayout(supabase, {
          affiliate_id: affiliateIdMeta,
          amount_cents: affCut,
          status: payoutStatus,
          stripe_transfer_id: transferId,
          orders_included: [orderId],
          paid_at: payoutStatus === "sent" ? new Date().toISOString() : null,
        });

        await affiliateRepo.incrementStats(supabase, affiliateIdMeta, affCut);

        await auditLogRepo.insertEntry(supabase, {
          action: "affiliate.conversion",
          resource_type: "order",
          resource_id: orderId,
          metadata: {
            affiliate_id: affiliateIdMeta,
            amount_cents: affCut,
            transfer_id: transferId,
            status: payoutStatus,
          },
        });
      }
    } catch (affErr) {
      console.error("Affiliate payout failed:", affErr);
    }
  }

  // ── 3. Create document records ─────────────────────────────
  const documentTypes =
    productType === "trust"
      ? ["trust", "pour_over_will", "poa", "healthcare_directive"]
      : ["will", "poa", "healthcare_directive"];

  const documentRecords = documentTypes.map((docType) => ({
    order_id: orderId,
    client_id: clientId,
    document_type: docType,
    template_version: "1.0",
    status: "pending" as const,
  }));
  await documentRepo.insertMany(supabase, documentRecords);

  // ── 4. Attorney review record if requested ─────────────────
  if (attorneyReview) {
    await handleAttorneyReview(supabase, orderId, partnerId, productType);
  }

  // ── 4b. Queue document generation ───────────────────────────
  try {
    const { addJob } = await import("@/lib/queue/document-queue");
    const { randomUUID } = await import("crypto");

    const { data: quizData } = await quizSessionRepo.getLatestAnswersByClient(supabase, clientId)
      .then(r => r, () => ({ data: null }));

    await addJob({
      job_id: randomUUID(),
      order_id: orderId,
      client_id: clientId || "",
      document_types: documentTypes,
      intake_answers: (quizData?.answers as Record<string, unknown>) || {},
      product_type: productType,
      partner_id: undefined,
      attorney_review: attorneyReview,
      status: "queued",
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      attempts: 0,
      error: null,
    });

    console.log("Document generation job queued for order:", orderId);
  } catch (queueError) {
    console.error("Failed to queue document generation:", queueError);
  }

  // ── 8. Audit log ───────────────────────────────────────────
  await auditLogRepo.insertEntry(supabase, {
    actor_id: profileId,
    action: "order.paid",
    resource_type: "order",
    resource_id: orderId,
    metadata: {
      product_type: productType,
      amount: session.amount_total,
      attorney_review: attorneyReview,
      email_sent: !!customerEmail,
    },
  });
}

// ── ATTORNEY REVIEW ROUTING ──────────────────────────────────
async function handleAttorneyReview(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  partnerId: string | undefined,
  productType: "will" | "trust",
) {
  const { resolveReviewRouting, INHOUSE_ATTORNEY_EMAIL, ESTATEVAULT_ADMIN_EMAIL } =
    await import("@/lib/attorney-review/routing");

  const slaDeadline = new Date();
  slaDeadline.setHours(slaDeadline.getHours() + 96);

  let partnerForRouting = null;
  if (partnerId) {
    const { data } = await partnerRepo.getReviewRoutingInfo(supabase, partnerId);
    partnerForRouting = data;
  }

  const { data: moProfile } = await profileRepo.findIdByEmailMaybe(supabase, INHOUSE_ATTORNEY_EMAIL);
  const { data: adminProfile } = await profileRepo.findIdByEmailMaybe(supabase, ESTATEVAULT_ADMIN_EMAIL);

  const routing = resolveReviewRouting(
    partnerForRouting,
    moProfile?.id || null,
    adminProfile?.id || null,
  );

  await attorneyReviewRepo.insert(supabase, {
    order_id: orderId,
    attorney_id: routing.reviewerId,
    status: "pending",
    attorney_fee: routing.feeAmount,
    fee_amount: routing.feeAmount,
    reviewer_type: routing.reviewerType,
    fee_destination: routing.feeDestination,
    fee_controlled_by: routing.feeControlledBy,
    partner_id: routing.partnerId,
    sla_deadline: slaDeadline.toISOString(),
  });

  if (routing.feeDestination === "partner_admin" && partnerForRouting?.stripe_account_id) {
    try {
      const transfer = await stripe.transfers.create({
        amount: routing.feeAmount,
        currency: "usd",
        destination: partnerForRouting.stripe_account_id,
        transfer_group: orderId,
        metadata: {
          type: "attorney_review_fee",
          order_id: orderId,
          reviewer_type: routing.reviewerType,
        },
      });
      await auditLogRepo.insertEntry(supabase, {
        action: "attorney_review.fee_transferred",
        resource_type: "attorney_review",
        resource_id: orderId,
        metadata: {
          destination: "partner_admin",
          amount: routing.feeAmount,
          transfer_id: transfer.id,
          partner_id: routing.partnerId,
        },
      });
    } catch (transferErr) {
      console.error("Attorney review fee transfer failed:", transferErr);
    }
  }
}

// ── GUEST CLIENT RESOLUTION ─────────────────────────────────
async function resolveOrCreateGuestClient(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  partnerId: string | null,
  productType: "vault" | "will" | "trust",
): Promise<string | null> {
  const guestEmail = metadata.guest_email || session.customer_details?.email;
  const guestName = metadata.guest_name || session.customer_details?.name || "";

  if (!guestEmail) return null;

  let profileId: string | null = null;
  const { data: existingProfile } = await profileRepo.findIdByEmailMaybe(supabase, guestEmail);

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: authMatch } = await supabase
      .rpc("find_auth_user_by_email", { lookup_email: guestEmail })
      .returns<{ id: string; email: string }[]>()
      .maybeSingle();

    if (authMatch) {
      profileId = authMatch.id;
      await profileRepo.upsert(supabase, {
        id: profileId,
        email: guestEmail,
        full_name: guestName,
        user_type: "client",
      });
    } else {
      const { data: newUser } = await supabase.auth.admin.createUser({
        email: guestEmail,
        email_confirm: true,
        user_metadata: { user_type: "client", full_name: guestName },
      });
      if (newUser?.user) {
        profileId = newUser.user.id;
        await profileRepo.upsert(supabase, {
          id: profileId,
          email: guestEmail,
          full_name: guestName,
          user_type: "client",
        });

        const originUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
        await sendWelcomeEmail({
          to: guestEmail,
          fullName: guestName || null,
          productType,
          loginLink: `${originUrl}/auth/login?email=${encodeURIComponent(guestEmail)}`,
          partnerId,
        });
        await auditLogRepo.insertEntry(supabase, {
          action: "email.welcome_sent",
          resource_type: "profile",
          resource_id: profileId,
        });
      }
    }
  }

  if (!profileId) return null;

  const { data: existingClient } = await clientRepo.findByProfileId(supabase, profileId)
    .then(r => r, () => ({ data: null }));

  if (existingClient) return existingClient.id;

  const { data: newClient } = await clientRepo.create(supabase, {
    profile_id: profileId,
    partner_id: partnerId,
    source: partnerId ? "partner" : "direct",
  });
  return newClient?.id ?? null;
}
