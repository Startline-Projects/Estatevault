export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { buildAssetChecklist } from "@/lib/email";
import { calculateSplit, transferToPartner } from "@/lib/stripe-payouts";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── VAULT SUBSCRIPTION EVENTS ───────────────────────────────
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    // Only handle renewals, not initial subscription (handled by checkout.session.completed)
    if (invoice.billing_reason === "subscription_cycle") {
      const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | null;
      if (subscriptionId) {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        await supabase
          .from("clients")
          .update({ vault_subscription_status: "active", vault_subscription_expiry: expiry.toISOString() })
          .eq("vault_subscription_stripe_id", subscriptionId);
        await supabase.from("audit_log").insert({
          action: "subscription.renewed",
          resource_type: "client",
          metadata: { subscription_id: subscriptionId },
        });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | null;
    if (subscriptionId) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, profile_id")
        .eq("vault_subscription_stripe_id", subscriptionId)
        .single();
      if (client) {
        await supabase.from("clients").update({ vault_subscription_status: "past_due" }).eq("id", client.id);
        // Send dunning email
        try {
          const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", client.profile_id).single();
          if (profile?.email) {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: "EstateVault <info@estatevault.us>",
              to: profile.email,
              subject: "Action Required, Vault Subscription Payment Failed",
              html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:32px;"><h1 style="color:#1C3557;">Payment Failed</h1><p>Hi ${profile.full_name || "there"},</p><p>We were unable to process your annual Vault subscription payment of $99. Your premium vault features (free amendments, farewell messages) will be paused until payment is resolved.</p><p>Please update your payment method to continue enjoying these benefits.</p><a href="https://www.estatevault.us/dashboard/settings" style="display:inline-block;background:#C9A84C;color:white;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:14px;">Update Payment Method</a></div>`,
            });
          }
        } catch (emailErr) { console.error("Dunning email failed:", emailErr); }
        await supabase.from("audit_log").insert({ action: "subscription.payment_failed", resource_type: "client", resource_id: client.id });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from("clients")
      .update({ vault_subscription_status: "cancelled", vault_subscription_stripe_id: null })
      .eq("vault_subscription_stripe_id", subscription.id);
    await supabase.from("audit_log").insert({
      action: "subscription.deleted",
      resource_type: "client",
      metadata: { subscription_id: subscription.id },
    });
    return NextResponse.json({ received: true });
  }

  // ── CHECKOUT SESSION COMPLETED ──────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Handle partner platform fee checkout
    if (metadata.type === "partner_platform_fee") {
      const partnerId = metadata.partner_id;
      if (partnerId) {
        await supabase.from("partners").update({
          one_time_fee_paid: true,
          onboarding_step: 2,
          platform_fee_amount: session.amount_total || 0,
        }).eq("id", partnerId);
        await supabase.from("audit_log").insert({
          action: "partner.platform_fee_paid",
          resource_type: "partner",
          resource_id: partnerId,
          metadata: { tier: metadata.tier, amount: session.amount_total },
        });
      } else {
        console.error("partner_platform_fee webhook received without partner_id in metadata");
      }
      return NextResponse.json({ received: true });
    }

    // Handle vault subscription checkout
    if (metadata.product_type === "vault_subscription") {
      const clientId = metadata.client_id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      await supabase.from("clients").update({
        vault_subscription_status: "active",
        vault_subscription_expiry: expiry.toISOString(),
        vault_subscription_stripe_id: subscriptionId,
      }).eq("id", clientId);
      await supabase.from("audit_log").insert({
        action: "subscription.activated",
        resource_type: "client",
        resource_id: clientId,
        metadata: { subscription_id: subscriptionId },
      });
      return NextResponse.json({ received: true });
    }

    const orderId = metadata.order_id;
    const clientId = metadata.client_id;
    const productType = metadata.product_type as "will" | "trust";
    const attorneyReview = metadata.attorney_review === "true";
    const customerEmail = session.customer_details?.email;

    if (!orderId) {
      console.error("No order_id in session metadata");
      return NextResponse.json({ received: true });
    }

    // Use the supabase admin client created above

    // ── 1. Ensure user account exists ──────────────────────────
    let profileId: string | null = null;
    // Name comes from checkout metadata (set from intakeAnswers), fallback to Stripe customer name
    const clientFullName = metadata.client_name || session.customer_details?.name || "";

    if (customerEmail) {
      // Check if profile already exists for this email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", customerEmail)
        .single();

      if (existingProfile) {
        profileId = existingProfile.id;
        // Update name if we have one and it's not already set
        if (clientFullName && !existingProfile.full_name) {
          await supabase.from("profiles").update({ full_name: clientFullName }).eq("id", profileId);
        }
      } else {
        // Check if auth user exists but no profile (signup happened before DB)
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const existingAuthUser = authUsers?.users?.find((u) => u.email === customerEmail);

        if (existingAuthUser) {
          // Create missing profile with name
          await supabase.from("profiles").insert({
            id: existingAuthUser.id,
            email: customerEmail,
            full_name: clientFullName || null,
            user_type: "client",
          });
          profileId = existingAuthUser.id;
        } else {
          // Auto-create auth account
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            user_metadata: { user_type: "client", full_name: clientFullName },
          });

          if (createError || !newUser.user) {
            console.error("Failed to auto-create user:", createError);
          } else {
            profileId = newUser.user.id;

            // The trigger should create the profile, but ensure it exists with name
            const { data: profileCheck } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", profileId)
              .single();

            if (!profileCheck) {
              await supabase.from("profiles").insert({
                id: profileId,
                email: customerEmail,
                full_name: clientFullName || null,
                user_type: "client",
              });
            } else if (clientFullName) {
              await supabase.from("profiles").update({ full_name: clientFullName }).eq("id", profileId);
            }
          }
        }

        // Ensure client record exists and is linked
        if (profileId && clientId) {
          const { data: clientRecord } = await supabase
            .from("clients")
            .select("id, profile_id")
            .eq("id", clientId)
            .single();

          if (clientRecord && !clientRecord.profile_id) {
            await supabase
              .from("clients")
              .update({ profile_id: profileId })
              .eq("id", clientId);
          } else if (!clientRecord) {
            await supabase.from("clients").insert({
              id: clientId,
              profile_id: profileId,
              source: "direct",
              state: "Michigan",
            });
          }
        }
      }
    }

    // ── 2. Update order to paid/generating ──────────────────────
    // Also ensure intake_data is saved (belt-and-suspenders, checkout should have saved it too)
    const { data: quizForIntake } = await supabase
      .from("quiz_sessions")
      .select("id, answers")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const updatePayload: Record<string, unknown> = {
      status: "generating",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    };
    if (quizForIntake) {
      updatePayload.intake_data = quizForIntake.answers;
      updatePayload.quiz_session_id = quizForIntake.id;
    }

    await supabase.from("orders").update(updatePayload).eq("id", orderId);

    // ── 2b. Partner payout via Stripe Connect ──────────────────
    const partnerId = metadata.partner_id;
    if (partnerId) {
      try {
        const { data: partner } = await supabase
          .from("partners")
          .select("stripe_account_id, tier")
          .eq("id", partnerId)
          .single();

        if (partner?.stripe_account_id && partner.tier) {
          const { evCut, partnerCut } = calculateSplit(
            productType,
            partner.tier as "standard" | "enterprise"
          );

          if (partnerCut > 0) {
            const transfer = await transferToPartner(
              partner.stripe_account_id,
              partnerCut,
              orderId,
              partnerId,
              productType
            );

            if (transfer) {
              // Update order with revenue split
              await supabase
                .from("orders")
                .update({
                  ev_cut: evCut,
                  partner_cut: partnerCut,
                })
                .eq("id", orderId);

              // Create payout record
              await supabase.from("payouts").insert({
                partner_id: partnerId,
                amount: partnerCut,
                status: "sent",
                stripe_transfer_id: transfer.id,
                orders_included: [orderId],
              });

              // Audit log
              await supabase.from("audit_log").insert({
                action: "payout.sent",
                resource_type: "payout",
                metadata: {
                  partner_id: partnerId,
                  amount: partnerCut,
                  transfer_id: transfer.id,
                },
              });
            }
          }
        } else if (partnerId) {
          // Store pending earnings, no Stripe account yet
          const { evCut, partnerCut } = calculateSplit(
            productType,
            (partner?.tier as "standard" | "enterprise") || "standard"
          );
          await supabase
            .from("orders")
            .update({ ev_cut: evCut, partner_cut: partnerCut })
            .eq("id", orderId);

          await supabase.from("payouts").insert({
            partner_id: partnerId,
            amount: partnerCut,
            status: "pending",
            orders_included: [orderId],
          });
        }
      } catch (payoutError) {
        console.error("Partner payout failed:", payoutError);
        // Don't fail the webhook, log and continue
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

    await supabase.from("documents").insert(documentRecords);

    // ── 4. Attorney review record if requested ─────────────────
    //
    // COMPLIANCE: Attorney review routing determines who reviews and where
    // the $300 fee goes. Mo Murshed is W-2 payroll, when reviews route to him,
    // the fee is EstateVault employment revenue, NOT fee-splitting.
    // Review Network attorneys receive 100%, EstateVault earns $0.
    //
    if (attorneyReview) {
      const { resolveReviewRouting, INHOUSE_ATTORNEY_EMAIL, ESTATEVAULT_ADMIN_EMAIL } = await import("@/lib/attorney-review/routing");

      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + 96); // 4 days

      // Look up partner record for routing
      let partnerForRouting = null;
      if (partnerId) {
        const { data } = await supabase
          .from("partners")
          .select("id, profile_id, professional_type, has_inhouse_estate_attorney, inhouse_review_attorney_id, custom_review_fee, stripe_account_id")
          .eq("id", partnerId)
          .single();
        partnerForRouting = data;
      }

      // Look up Mo's profile ID
      const { data: moProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", INHOUSE_ATTORNEY_EMAIL)
        .single();

      // Look up admin profile ID
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", ESTATEVAULT_ADMIN_EMAIL)
        .single();

      const routing = resolveReviewRouting(
        partnerForRouting,
        moProfile?.id || null,
        adminProfile?.id || null
      );

      await supabase.from("attorney_reviews").insert({
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

      // ── Handle fee routing via Stripe ──
      // COMPLIANCE: Mo is W-2 payroll, no Stripe transfer for inhouse_estatevault.
      // Revenue stays in EstateVault's Stripe account as employment revenue.
      if (routing.feeDestination === "partner_admin" && partnerForRouting?.stripe_account_id) {
        // Transfer $300 to partner's Stripe Connect, they pay their in-house attorney
        try {
          const transferAmount = routing.feeAmount;
          const transfer = await stripe.transfers.create({
            amount: transferAmount,
            currency: "usd",
            destination: partnerForRouting.stripe_account_id,
            transfer_group: orderId,
            metadata: {
              type: "attorney_review_fee",
              order_id: orderId,
              reviewer_type: routing.reviewerType,
            },
          });
          await supabase.from("audit_log").insert({
            action: "attorney_review.fee_transferred",
            resource_type: "attorney_review",
            metadata: {
              order_id: orderId,
              destination: "partner_admin",
              amount: transferAmount,
              transfer_id: transfer.id,
              partner_id: routing.partnerId,
            },
          });
        } catch (transferErr) {
          console.error("Attorney review fee transfer failed:", transferErr);
        }
      }
      // feeDestination === "estatevault" → no transfer needed, Mo is on payroll
      // feeDestination === "attorney_stripe_connect" → Review Network (future)
    }

    // ── 4b. Queue document generation ───────────────────────────
    try {
      const { addJob } = await import("@/lib/queue/document-queue");
      const { randomUUID } = await import("crypto");

      const { data: quizData } = await supabase
        .from("quiz_sessions")
        .select("answers")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

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

    // ── 5. Pre-populate vault with estate documents entry ──────
    if (clientId) {
      await supabase.from("vault_items").insert({
        client_id: clientId,
        category: "estate_document",
        label: productType === "trust" ? "Trust Package" : "Will Package",
        data: {
          order_id: orderId,
          product_type: productType,
          documents: documentTypes,
          status: attorneyReview ? "under_review" : "generating",
          note: "Documents will be available for download once generated.",
        },
      });
    }

    // ── 6. Save asset checklist to client record (trust only) ──
    if (productType === "trust" && clientId) {
      // Retrieve intake answers to get asset types
      const { data: quizSession } = await supabase
        .from("quiz_sessions")
        .select("answers")
        .eq("client_id", clientId)
        .eq("recommendation", "trust")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (quizSession?.answers) {
        const answers = quizSession.answers as Record<string, unknown>;
        const assetTypes = answers.assetTypes as string[] | undefined;

        if (assetTypes && assetTypes.length > 0) {
          // Save asset checklist as a vault item
          await supabase.from("vault_items").insert({
            client_id: clientId,
            category: "estate_document",
            label: "Asset Funding Checklist",
            data: {
              order_id: orderId,
              assets: buildAssetChecklist(assetTypes),
              status: "action_required",
            },
          });
        }
      }
    }

    // ── 7. Email removed, client sets password on success page ──
    // No automatic email sent. Client creates password inline on
    // the success page and can send documents to their email later
    // via the "Send documents to my email" button on their dashboard.

    // ── 8. Audit log ───────────────────────────────────────────
    await supabase.from("audit_log").insert({
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

  return NextResponse.json({ received: true });
}
