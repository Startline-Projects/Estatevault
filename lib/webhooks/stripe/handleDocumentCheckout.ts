import Stripe from "stripe";
import { getAppUrl } from "@/lib/config/appUrl";
import { sendWelcomeEmail } from "@/lib/email";
import { isQueueConfigured } from "@/lib/queue/document-queue";
import { calculateSplit, transferToPartner, transferToAffiliate } from "@/lib/stripe-payouts";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as documentRepo from "@/lib/repos/server/documentRepo";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";
import * as affiliateRepo from "@/lib/repos/server/affiliateRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { evaluateHardStop } from "@/lib/compliance/hardStop";
import { handleAmendmentCheckout } from "./handleAmendmentCheckout";
import { handleAttorneyReview } from "./handleAttorneyReview";
import type { Admin } from "./types";

// Will/Trust (and amendment routing) checkout: ensure the user account exists,
// mark the order generating, pay partner/affiliate cuts, create document
// records, route attorney review, and queue document generation.
export async function handleDocumentCheckout(
  supabase: Admin,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const orderId = metadata.order_id;
  const clientId = metadata.client_id;
  const rawProductType = metadata.product_type;
  const attorneyReview = metadata.attorney_review === "true";
  const customerEmail = session.customer_details?.email;

  if (!orderId) {
    console.error("No order_id in session metadata");
    return;
  }

  // ── AMENDMENT (H-1) ─────────────────────────────────────────
  // A paid amendment must NOT fall through to the will/trust path (which would
  // generate a full document set). Mark it paid/generating only — mirrors the
  // free subscriber path in checkout/amendment/route.ts.
  if (rawProductType === "amendment") {
    await handleAmendmentCheckout(supabase, session, orderId);
    return;
  }

  const productType = rawProductType as "will" | "trust";

  // ── 0. Replay safety (BUG-1) ───────────────────────────────
  // This handler can run more than once for the same order: Stripe redelivers
  // on a prior failure, and the reconcile cron re-dispatches stuck orders.
  // Load existing state so each side-effect below (payout, document rows,
  // attorney review) is applied at most once. A fully-processed order that is
  // not a failed/stuck retry is a no-op.
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("status, intake_data")
    .eq("id", orderId)
    .maybeSingle();

  const { data: existingDocs } = await supabase
    .from("documents")
    .select("document_type")
    .eq("order_id", orderId);

  const { data: existingPayout } = await supabase
    .from("payouts")
    .select("id")
    .contains("orders_included", [orderId])
    .maybeSingle();

  const payoutAlreadySent = !!existingPayout;

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

          const origin = getAppUrl();
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

  // ── HARD STOP (Core Rule 4) — last checkpoint ──────────────
  // Checkout already blocks this, but the webhook is the final gate before any
  // document is created. Re-derive from whatever intake we have; if halted,
  // park the order for an attorney and never create document records or queue
  // generation. No override.
  const intakeForStop =
    (quizForIntake?.answers as Record<string, unknown> | undefined) ??
    (existingOrder?.intake_data as Record<string, unknown> | null | undefined);
  if (evaluateHardStop(intakeForStop).halted) {
    console.error(`Hard stop hit in webhook for order ${orderId}; halting generation.`);
    await orderRepo.update(supabase, orderId, { status: "needs_attorney" });
    return;
  }

  // Never downgrade an order that already advanced to attorney review (locked)
  // or delivery — only move it forward from a pre-generation state. This keeps
  // the attorney-review lock intact across replays/reconcile retries.
  const lockedOrDelivered =
    existingOrder?.status === "review" || existingOrder?.status === "delivered";

  const updatePayload: Record<string, unknown> = {
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  };
  if (!lockedOrDelivered) {
    updatePayload.status = "generating";
  }
  if (quizForIntake) {
    updatePayload.intake_data = quizForIntake.answers;
    updatePayload.quiz_session_id = quizForIntake.id;
  }
  await orderRepo.update(supabase, orderId, updatePayload);

  // ── 2b. Partner payout via Stripe Connect ──────────────────
  // Skip entirely on replay if a payout for this order already exists — never
  // transfer partner/affiliate money twice (BUG-1 replay safety).
  const partnerId = metadata.partner_id;
  if (partnerId && !payoutAlreadySent) {
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
  const { data: existingAffPayout } = affiliateIdMeta
    ? await supabase
        .from("affiliate_payouts")
        .select("id")
        .contains("orders_included", [orderId])
        .maybeSingle()
    : { data: null };
  if (affiliateIdMeta && !partnerId && !existingAffPayout) {
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

        // BUG-23: the orders_included unique index makes this insert the single
        // gate per order. Only the winning insert returns a row; a concurrent
        // replay that loses the race gets null and must NOT touch the
        // irreversible affiliate stats counter again.
        const { data: insertedPayout } = await payoutRepo.insertAffiliatePayout(supabase, {
          affiliate_id: affiliateIdMeta,
          amount_cents: affCut,
          status: payoutStatus,
          stripe_transfer_id: transferId,
          order_id: orderId,
          orders_included: [orderId],
          paid_at: payoutStatus === "sent" ? new Date().toISOString() : null,
        });

        if (insertedPayout) {
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

  // On replay only create rows for types not already present (no duplicates).
  const existingDocTypes = new Set((existingDocs || []).map((d) => d.document_type));
  const documentRecords = documentTypes
    .filter((docType) => !existingDocTypes.has(docType))
    .map((docType) => ({
      order_id: orderId,
      client_id: clientId,
      document_type: docType,
      template_version: "1.0",
      status: "pending" as const,
    }));
  if (documentRecords.length) {
    await documentRepo.insertMany(supabase, documentRecords);
  }

  // ── 4. Attorney review record if requested ─────────────────
  // Guard against a duplicate review record (and duplicate fee transfer) on
  // replay — only route review the first time.
  if (attorneyReview) {
    const { data: existingReview } = await supabase
      .from("attorney_reviews")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!existingReview) {
      await handleAttorneyReview(supabase, orderId, partnerId, productType);
    }
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
    // The Upstash queue is OPTIONAL and best-effort. When it is not provisioned
    // (the default in this deployment) addJob always throws — that is expected,
    // because generation actually runs via the synchronous success-page path
    // (processNow) and the daily /api/documents/process sweep. So a queue
    // failure here is NOT an order failure and must not block the webhook.
    //
    // The real "paid but no documents" safety net is the reconcile cron, which
    // checks the end result (are the finished PDFs there?) regardless of which
    // generation path ran, and re-triggers + alerts if they are missing.
    const message = queueError instanceof Error ? queueError.message : "Unknown error";
    if (isQueueConfigured) {
      // Queue IS configured but the push errored — worth noting, still not fatal
      // (processNow / the sweep will generate; reconcile catches stragglers).
      console.error("Failed to enqueue document generation job:", message);
    } else {
      console.log("Document queue not configured — relying on processNow + sweep for", orderId);
    }
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
