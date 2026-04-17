import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { calculateSplit } from "@/lib/stripe-payouts";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, attorneyReview, intakeAnswers, complexityFlag, complexityReasons, declinedAttorneyReview, promoCode, email: promoEmail, partnerId } = body;

    if (!intakeAnswers) {
      return NextResponse.json({ error: "Missing intake answers" }, { status: 400 });
    }

    const VALID_PROMO_CODES: Record<string, boolean> = { FREE134: true };
    const isPromoFree = promoCode && VALID_PROMO_CODES[promoCode.toUpperCase()];
    const isTestCode = promoCode && promoCode.toUpperCase() === "TEST";

    const supabase = createAdminClient();

    // ── TEST PROMO CODE ────────────────────────────────────
    if (isTestCode) {
      // Only valid on estatevault.us, block on partner URLs
      const origin = request.headers.get("origin") || request.headers.get("referer") || request.headers.get("host") || "";
      const isPartnerUrl = origin.includes("legacy.");
      const isEstateVault = origin.includes("estatevault.us");
      if (isPartnerUrl || (!isEstateVault && origin !== "" && !origin.includes("localhost"))) {
        return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
      }

      const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "test_promo_code").single();
      const testActive = (setting?.value as { active?: boolean })?.active ?? false;
      if (!testActive) {
        return NextResponse.json({ error: "This code is not valid" }, { status: 400 });
      }

      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "test_promo.used").gte("created_at", oneHourAgo);
      if ((count || 0) >= 50) {
        return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        product_type: "trust",
        status: "generating",
        amount_total: 0,
        ev_cut: 0,
        order_type: "test",
        expires_at: expiresAt,
        acknowledgment_signed: true,
        acknowledgment_signed_at: new Date().toISOString(),
        intake_data: intakeAnswers,
      }).select("id").single();

      if (orderErr || !order) {
        console.error("Test order creation error:", orderErr);
        return NextResponse.json({ error: "Failed to create test order" }, { status: 500 });
      }

      const { data: quizSession } = await supabase.from("quiz_sessions").insert({
        answers: { ...intakeAnswers, declinedAttorneyReview: true },
        recommendation: "trust",
        completed: true,
      }).select("id").single();

      if (quizSession) {
        await supabase.from("orders").update({ quiz_session_id: quizSession.id }).eq("id", order.id);
      }

      const docTypes = ["trust", "pour_over_will", "poa", "healthcare_directive"];
      await supabase.from("documents").insert(docTypes.map((dt) => ({
        order_id: order.id, document_type: dt, status: "pending", template_version: "1.0",
      })));

      await supabase.from("audit_log").insert({
        action: "test_promo.used",
        resource_type: "order",
        resource_id: order.id,
        metadata: { product_type: "trust", promo_code: "TEST" },
      });

      return NextResponse.json({ test: true, orderId: order.id });
    }

    // Get or create client
    let clientId: string;

    if (userId) {
      // Logged-in user, find or create their client record
      const { data: existingClient } = await supabase.from("clients").select("id").eq("profile_id", userId).single();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({ profile_id: userId, source: partnerId ? "partner" : "direct", state: "Michigan", partner_id: partnerId || null })
          .select("id")
          .single();

        if (clientError || !newClient) {
          console.error("Client creation error:", clientError);
          return NextResponse.json({ error: "Failed to create client record" }, { status: 500 });
        }
        clientId = newClient.id;
      }
    } else {
      // Anonymous user, create client record without profile_id
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({ source: partnerId ? "partner" : "direct", state: "Michigan", partner_id: partnerId || null })
        .select("id")
        .single();

      if (clientError || !newClient) {
        console.error("Anonymous client creation error:", clientError);
        return NextResponse.json({ error: "Failed to create client record" }, { status: 500 });
      }
      clientId = newClient.id;
    }

    const trustAmount = 60000; // $600
    const attorneyAmount = attorneyReview ? 30000 : 0;
    const totalAmount = trustAmount + attorneyAmount;

    // Calculate ev/partner split based on partner tier
    let evCut = 20000; // Default: direct sale, EV keeps $200
    let partnerCut = 0;
    if (partnerId) {
      const { data: partnerData } = await supabase
        .from("partners")
        .select("tier")
        .eq("id", partnerId)
        .single();
      const tier = (partnerData?.tier || "standard") as "standard" | "enterprise";
      const split = calculateSplit("trust", tier);
      evCut = split.evCut;
      partnerCut = split.partnerCut;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        client_id: clientId,
        product_type: "trust",
        status: "pending",
        amount_total: totalAmount,
        ev_cut: evCut,
        partner_cut: partnerCut,
        partner_id: partnerId || null,
        attorney_review_requested: attorneyReview,
        attorney_cut: attorneyAmount,
        complexity_flag: complexityFlag || false,
        complexity_flag_reason: complexityReasons?.join("; ") || null,
        acknowledgment_signed: true,
        acknowledgment_signed_at: new Date().toISOString(),
        intake_data: intakeAnswers,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Save intake and link quiz_session_id to order
    const { data: quizSession } = await supabase.from("quiz_sessions").insert({
      client_id: clientId,
      answers: { ...intakeAnswers, declinedAttorneyReview },
      recommendation: "trust",
      completed: true,
    }).select("id").single();

    if (quizSession) {
      await supabase.from("orders").update({ quiz_session_id: quizSession.id }).eq("id", order.id);
    }

    // ── PROMO CODE: Free Trust ──────────────────────────────
    if (isPromoFree) {
      const emailAddr = promoEmail || intakeAnswers.email;
      if (!emailAddr) {
        return NextResponse.json({ error: "Email is required for promo orders" }, { status: 400 });
      }

      await supabase.from("orders").update({
        amount_total: 0, ev_cut: 0, partner_cut: 0, attorney_cut: 0,
        status: "generating",
        attorney_review_requested: false,
      }).eq("id", order.id);

      // Create user account with temp password
      let profileId = userId;
      const { generateTempPassword } = await import("@/lib/utils/generate-password");
      const tempPassword = generateTempPassword();

      if (!profileId) {
        const { data: existingUser } = await supabase.from("profiles").select("id").eq("email", emailAddr).single();
        if (existingUser) {
          profileId = existingUser.id;
          // Update password for existing user so temp password works
          await supabase.auth.admin.updateUserById(existingUser.id, { password: tempPassword });
        } else {
          const fullName = `${intakeAnswers.firstName || ""} ${intakeAnswers.lastName || ""}`.trim();
          // Check if auth user exists even without a profile (orphaned from previous attempt)
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const existingAuthUser = authUsers?.users?.find((u) => u.email === emailAddr);

          if (existingAuthUser) {
            // Auth user exists but no profile, update password and create profile
            profileId = existingAuthUser.id;
            await supabase.auth.admin.updateUserById(existingAuthUser.id, { password: tempPassword });
            await supabase.from("profiles").upsert({
              id: existingAuthUser.id, email: emailAddr,
              full_name: fullName,
              user_type: "client",
            });
          } else {
            const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
              email: emailAddr,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name: fullName, user_type: "client" },
            });
            console.log("createUser result:", { user: newUser?.user?.id, error: createErr?.message });
            if (newUser?.user) {
              profileId = newUser.user.id;
              await supabase.from("profiles").upsert({
                id: newUser.user.id, email: emailAddr,
                full_name: fullName,
                user_type: "client",
              });
            } else if (createErr) {
              console.error("Failed to create auth user:", createErr.message);
            }
          }
        }
        if (profileId) {
          await supabase.from("clients").update({ profile_id: profileId }).eq("id", clientId);
        }
      }

      // No email sent, client sets password on success page
      // and can send documents to their email from the dashboard

      const docTypes = ["trust", "pour_over_will", "poa", "healthcare_directive"];
      await supabase.from("documents").insert(docTypes.map((dt) => ({
        order_id: order.id, document_type: dt, status: "pending", template_version: "1.0",
      })));

      await supabase.from("audit_log").insert({
        actor_id: profileId || null,
        action: "checkout.promo_free",
        resource_type: "order",
        resource_id: order.id,
        metadata: { product_type: "trust", promo_code: promoCode, email: emailAddr },
      });

      return NextResponse.json({ free: true, orderId: order.id, email: emailAddr, userId: profileId });
    }

    const lineItems: Array<{
      price_data: { currency: string; product_data: { name: string; description?: string }; unit_amount: number };
      quantity: number;
    }> = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Trust Package",
            description: "Revocable Living Trust, Pour-Over Will, Power of Attorney, Healthcare Directive, Asset Funding Checklist, Family Vault Access",
          },
          unit_amount: trustAmount,
        },
        quantity: 1,
      },
    ];

    if (attorneyReview) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Attorney Review",
            description: "Licensed Michigan attorney review of your trust documents (48hr turnaround)",
          },
          unit_amount: attorneyAmount,
        },
        quantity: 1,
      });
    }

    const origin = request.headers.get("origin") || "https://www.estatevault.us";

    const clientName = `${intakeAnswers.firstName || ""} ${intakeAnswers.lastName || ""}`.trim();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: intakeAnswers.email || undefined,
      success_url: `${origin}/trust/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trust/checkout`,
      metadata: {
        order_id: order.id,
        client_id: clientId,
        product_type: "trust",
        attorney_review: attorneyReview ? "true" : "false",
        partner_id: partnerId || "",
        client_name: clientName,
      },
    });

    await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    await supabase.from("audit_log").insert({
      actor_id: userId || null,
      action: "checkout.started",
      resource_type: "order",
      resource_id: order.id,
      metadata: { product_type: "trust", attorney_review: attorneyReview, complexity_flag: complexityFlag },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
