import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { sendDocumentEmail, buildAssetChecklist } from "@/lib/email";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const orderId = metadata.order_id;
    const clientId = metadata.client_id;
    const productType = metadata.product_type as "will" | "trust";
    const attorneyReview = metadata.attorney_review === "true";
    const customerEmail = session.customer_details?.email;

    if (!orderId) {
      console.error("No order_id in session metadata");
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    // ── 1. Ensure user account exists ──────────────────────────
    let profileId: string | null = null;

    if (customerEmail) {
      // Check if profile already exists for this email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", customerEmail)
        .single();

      if (existingProfile) {
        profileId = existingProfile.id;
      } else {
        // Check if auth user exists but no profile (signup happened before DB)
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const existingAuthUser = authUsers?.users?.find((u) => u.email === customerEmail);

        if (existingAuthUser) {
          // Create missing profile
          await supabase.from("profiles").insert({
            id: existingAuthUser.id,
            email: customerEmail,
            user_type: "client",
          });
          profileId = existingAuthUser.id;
        } else {
          // Auto-create auth account
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            user_metadata: { user_type: "client" },
          });

          if (createError || !newUser.user) {
            console.error("Failed to auto-create user:", createError);
          } else {
            profileId = newUser.user.id;

            // The trigger should create the profile, but ensure it exists
            const { data: profileCheck } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", profileId)
              .single();

            if (!profileCheck) {
              await supabase.from("profiles").insert({
                id: profileId,
                email: customerEmail,
                user_type: "client",
              });
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

    // ── 2. Update order to paid ────────────────────────────────
    await supabase
      .from("orders")
      .update({
        status: attorneyReview ? "review" : "generating",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("id", orderId);

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
    if (attorneyReview) {
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + 48);

      await supabase.from("attorney_reviews").insert({
        order_id: orderId,
        status: "pending",
        attorney_fee: 30000,
        sla_deadline: slaDeadline.toISOString(),
      });
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

    // ── 7. Send email with password link ───────────────────────
    if (customerEmail) {
      try {
        // Generate a magic link for password setup
        const { data: linkData, error: linkError } =
          await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: customerEmail,
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?redirect=/dashboard`,
            },
          });

        const passwordLink = linkError || !linkData?.properties?.action_link
          ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/login`
          : linkData.properties.action_link;

        // Build asset checklist for trust emails
        let assetChecklist: { asset: string; instruction: string }[] | undefined;
        if (productType === "trust") {
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
            if (assetTypes) {
              assetChecklist = buildAssetChecklist(assetTypes);
            }
          }
        }

        await sendDocumentEmail({
          to: customerEmail,
          productType,
          passwordLink,
          assetChecklist,
        });
      } catch (emailErr) {
        // Log but don't fail the webhook
        console.error("Email send failed:", emailErr);
      }
    }

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
