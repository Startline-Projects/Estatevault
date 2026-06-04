import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { calculateSplit } from "@/lib/stripe-payouts";
import { AFFILIATE_COOKIE } from "@/lib/affiliate";
import { checkPlanConflict } from "@/lib/orders/plan-conflict";
import { createAdminClient } from "@/lib/api/auth";
import { PRICES, PROMO_CODES } from "@/lib/orders/pricing";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";
import * as affiliateRepo from "@/lib/repos/server/affiliateRepo";
import * as affiliateClickRepo from "@/lib/repos/server/affiliateClickRepo";
import * as documentRepo from "@/lib/repos/server/documentRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as appSettingsRepo from "@/lib/repos/server/appSettingsRepo";
import type { Database, Json } from "@/types/db.generated";

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

export type ProductConfig = {
  productType: "will" | "trust";
  baseAmount: number;
  defaultEvCut: number;
  docTypes: string[];
  recommendation: string;
  stripeName: string;
  stripeDescription: string;
  attorneyDescription: string;
  successPath: string;
  cancelPath: string;
};

export type CheckoutInput = {
  userId?: string | null;
  attorneyReview: boolean;
  intakeAnswers: Record<string, unknown>;
  promoCode?: string;
  email?: string;
  partnerId?: string | null;
  customerEmail?: string;
  complexityFlag?: boolean;
  complexityReasons?: string[];
  declinedAttorneyReview?: boolean;
  confirmOverride?: boolean;
};

export async function createCheckoutSession(
  request: Request,
  config: ProductConfig,
  input: CheckoutInput,
): Promise<NextResponse> {
  const {
    userId, attorneyReview, intakeAnswers, promoCode,
    email: promoEmail, partnerId, customerEmail,
    complexityFlag, complexityReasons, declinedAttorneyReview, confirmOverride,
  } = input;

  const conflictEmail: string | undefined =
    (typeof customerEmail === "string" && customerEmail) ||
    (typeof promoEmail === "string" && promoEmail) ||
    (intakeAnswers?.email as string | undefined);

  const upperPromo = promoCode?.toUpperCase() as keyof typeof PROMO_CODES | undefined;
  const isPromoFree = upperPromo && upperPromo in PROMO_CODES && PROMO_CODES[upperPromo] === "free";
  const isTestCode = upperPromo && upperPromo in PROMO_CODES && PROMO_CODES[upperPromo] === "test";

  const supabase = createAdminClient();

  if (!isTestCode && conflictEmail) {
    const conflict = await checkPlanConflict(supabase, conflictEmail, config.productType);
    if (conflict.action === "block") {
      return NextResponse.json({ error: conflict.message, conflict }, { status: 409 });
    }
    if (conflict.action === "override" && !confirmOverride) {
      return NextResponse.json(
        { error: conflict.message, conflict, requiresOverrideConfirm: true },
        { status: 409 },
      );
    }
  }

  // ── TEST PROMO CODE ────────────────────────────────────
  if (isTestCode) {
    return handleTestPromo(request, supabase, config, input);
  }

  // ── GET OR CREATE CLIENT ───────────────────────────────
  let clientId: string;

  // Resolve the profile to attach. A session can be orphaned after a data wipe:
  // the `profiles` row (and even the `auth.users` record) may be gone. Self-heal
  // where we can, and fall back to guest checkout when the account no longer exists
  // — the verified email links it back on the success page.
  let resolvedUserId: string | null = userId ?? null;
  if (resolvedUserId) {
    const { data: existingProfile } = await profileRepo.getMeById(supabase, resolvedUserId);
    if (!existingProfile) {
      const { data: authUser } = await supabase.auth.admin.getUserById(resolvedUserId);
      if (authUser?.user) {
        const meta = (authUser.user.user_metadata || {}) as Record<string, unknown>;
        await profileRepo.upsert(supabase, {
          id: resolvedUserId,
          email: authUser.user.email || (conflictEmail ?? ""),
          full_name: (meta.full_name as string) || `${(intakeAnswers.firstName as string) || ""} ${(intakeAnswers.lastName as string) || ""}`.trim(),
          user_type: "client",
        });
      } else {
        // Account fully wiped — proceed as a guest rather than dead-ending the user.
        console.warn("Checkout: orphaned session, no profile or auth record; continuing as guest:", resolvedUserId);
        resolvedUserId = null;
      }
    }
  }

  if (resolvedUserId) {
    const { data: existingClient } = await clientRepo.getIdByProfile(supabase, resolvedUserId);
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await clientRepo.create(supabase, {
        profile_id: resolvedUserId,
        source: partnerId ? "partner" : "direct",
        state: "Michigan",
        partner_id: partnerId || null,
      });
      if (clientError || !newClient) {
        console.error("Client creation error:", clientError);
        return NextResponse.json({ error: "Failed to create client record" }, { status: 500 });
      }
      clientId = newClient.id;
    }
  } else {
    const { data: newClient, error: clientError } = await clientRepo.create(supabase, {
      source: partnerId ? "partner" : "direct",
      state: "Michigan",
      partner_id: partnerId || null,
    });
    if (clientError || !newClient) {
      console.error("Anonymous client creation error:", clientError);
      return NextResponse.json({ error: "Failed to create client record" }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // ── AMOUNTS + SPLITS ──────────────────────────────────
  const attorneyAmount = attorneyReview ? PRICES.attorneyReview : 0;
  const totalAmount = config.baseAmount + attorneyAmount;

  let evCut = config.defaultEvCut;
  let partnerCut = 0;
  let affiliateId: string | null = null;
  let affiliateCut = 0;

  if (partnerId) {
    const { data: partnerData } = await partnerRepo.getTier(supabase, partnerId);
    const tier = (partnerData?.tier || "standard") as "standard" | "enterprise";
    const split = calculateSplit(config.productType, tier);
    evCut = split.evCut;
    partnerCut = split.partnerCut;
  } else {
    const affCookie = cookies().get(AFFILIATE_COOKIE)?.value;
    if (affCookie) {
      const { data: affRow } = await affiliateRepo.findPayoutStateById(supabase, affCookie);
      if (affRow && affRow.status === "active") {
        const split = calculateSplit(config.productType, "standard", { affiliate: true });
        evCut = split.evCut;
        affiliateCut = split.affiliateCut;
        affiliateId = affRow.id;
      }
    }
  }

  // ── CREATE ORDER ───────────────────────────────────────
  const orderFields: OrderInsert = {
    client_id: clientId,
    product_type: config.productType,
    status: "pending",
    amount_total: totalAmount,
    ev_cut: evCut,
    partner_cut: partnerCut,
    partner_id: partnerId || null,
    affiliate_id: affiliateId,
    affiliate_cut: affiliateCut,
    attorney_review_requested: attorneyReview,
    attorney_cut: attorneyAmount,
    acknowledgment_signed: true,
    acknowledgment_signed_at: new Date().toISOString(),
    intake_data: intakeAnswers as Json,
    complexity_flag: complexityFlag !== undefined ? complexityFlag : undefined,
    complexity_flag_reason: complexityReasons?.length ? complexityReasons.join("; ") : undefined,
  };

  const { data: order, error: orderError } = await orderRepo.insert(supabase, orderFields);
  if (orderError || !order) {
    console.error("Order creation error:", orderError);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // ── QUIZ SESSION ───────────────────────────────────────
  const quizAnswers = declinedAttorneyReview !== undefined
    ? { ...intakeAnswers, declinedAttorneyReview }
    : intakeAnswers;

  const { data: quizSession } = await quizSessionRepo.insertReturningId(supabase, {
    client_id: clientId,
    answers: quizAnswers as Json,
    recommendation: config.recommendation,
    completed: true,
  });

  if (quizSession) {
    await orderRepo.update(supabase, order.id, { quiz_session_id: quizSession.id });
  }

  // ── FREE PROMO ─────────────────────────────────────────
  if (isPromoFree) {
    return handleFreePromo(supabase, config, input, order.id, clientId);
  }

  // ── STRIPE SESSION ─────────────────────────────────────
  const lineItems: Array<{
    price_data: { currency: string; product_data: { name: string; description?: string }; unit_amount: number };
    quantity: number;
  }> = [
    {
      price_data: {
        currency: "usd",
        product_data: { name: config.stripeName, description: config.stripeDescription },
        unit_amount: config.baseAmount,
      },
      quantity: 1,
    },
  ];

  if (attorneyReview) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Attorney Review", description: config.attorneyDescription },
        unit_amount: attorneyAmount,
      },
      quantity: 1,
    });
  }

  const origin = request.headers.get("origin") || "https://www.estatevault.us";
  const clientName = `${(intakeAnswers.firstName as string) || ""} ${(intakeAnswers.lastName as string) || ""}`.trim();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer_email: conflictEmail || (intakeAnswers.email as string) || undefined,
    success_url: `${origin}${config.successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${config.cancelPath}`,
    metadata: {
      order_id: order.id,
      client_id: clientId,
      product_type: config.productType,
      attorney_review: attorneyReview ? "true" : "false",
      partner_id: partnerId || "",
      affiliate_id: affiliateId || "",
      client_name: clientName,
    },
  });

  if (affiliateId) {
    const { data: latestClick } = await affiliateClickRepo.findLatestUnconverted(supabase, affiliateId);
    if (latestClick) {
      await affiliateClickRepo.markConverted(supabase, latestClick.id, order.id);
    }
  }

  await orderRepo.update(supabase, order.id, { stripe_session_id: session.id });

  const auditMeta: Record<string, unknown> = {
    product_type: config.productType,
    attorney_review: attorneyReview,
  };
  if (complexityFlag !== undefined) auditMeta.complexity_flag = complexityFlag;

  await supabase.from("audit_log").insert({
    actor_id: resolvedUserId,
    action: "checkout.started",
    resource_type: "order",
    resource_id: order.id,
    metadata: auditMeta as Json,
  });

  return NextResponse.json({ url: session.url });
}

// ── HELPERS ────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

async function handleTestPromo(
  request: Request,
  supabase: Admin,
  config: ProductConfig,
  input: CheckoutInput,
): Promise<NextResponse> {
  const { intakeAnswers, declinedAttorneyReview } = input;

  const origin = request.headers.get("origin") || request.headers.get("referer") || request.headers.get("host") || "";
  const isPartnerUrl = origin.includes("legacy.");
  const isEstateVault = origin.includes("estatevault.us");
  if (isPartnerUrl || (!isEstateVault && origin !== "" && !origin.includes("localhost"))) {
    return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
  }

  const { data: setting } = await appSettingsRepo.getByKey(supabase, "test_promo_code");
  const testActive = (setting?.value as { active?: boolean })?.active ?? false;
  if (!testActive) {
    return NextResponse.json({ error: "This code is not valid" }, { status: 400 });
  }

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "test_promo.used")
    .gte("created_at", oneHourAgo);
  if ((count || 0) >= 50) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let testAffiliateId: string | null = null;
  let testAffiliateCut = 0;
  const testAffCookie = cookies().get(AFFILIATE_COOKIE)?.value;
  if (testAffCookie) {
    const { data: affRow } = await affiliateRepo.findStatusById(supabase, testAffCookie);
    if (affRow && affRow.status === "active") {
      testAffiliateId = affRow.id;
      testAffiliateCut = calculateSplit(config.productType, "standard", { affiliate: true }).affiliateCut;
    }
  }

  const { data: order, error: orderErr } = await orderRepo.insert(supabase, {
    product_type: config.productType,
    status: "generating",
    amount_total: 0,
    ev_cut: 0,
    order_type: "test",
    expires_at: expiresAt,
    affiliate_id: testAffiliateId,
    affiliate_cut: testAffiliateCut,
    acknowledgment_signed: true,
    acknowledgment_signed_at: new Date().toISOString(),
    intake_data: intakeAnswers as Json,
  });

  if (orderErr || !order) {
    console.error("Test order creation error:", orderErr);
    return NextResponse.json({ error: "Failed to create test order" }, { status: 500 });
  }

  if (testAffiliateId) {
    const { data: latestClick } = await affiliateClickRepo.findLatestUnconverted(supabase, testAffiliateId);
    if (latestClick) {
      await affiliateClickRepo.markConverted(supabase, latestClick.id, order.id);
    }
  }

  const quizAnswers = declinedAttorneyReview
    ? { ...intakeAnswers, declinedAttorneyReview: true }
    : intakeAnswers;

  const { data: quizSession } = await quizSessionRepo.insertReturningId(supabase, {
    answers: quizAnswers as Json,
    recommendation: config.recommendation,
    completed: true,
  });

  if (quizSession) {
    await orderRepo.update(supabase, order.id, { quiz_session_id: quizSession.id });
  }

  await documentRepo.insertMany(
    supabase,
    config.docTypes.map((dt) => ({
      order_id: order.id,
      document_type: dt,
      status: "pending",
      template_version: "1.0",
    })),
  );

  await supabase.from("audit_log").insert({
    action: "test_promo.used",
    resource_type: "order",
    resource_id: order.id,
    metadata: { product_type: config.productType, promo_code: "TEST" },
  });

  return NextResponse.json({ test: true, orderId: order.id });
}

async function handleFreePromo(
  supabase: Admin,
  config: ProductConfig,
  input: CheckoutInput,
  orderId: string,
  clientId: string,
): Promise<NextResponse> {
  const { userId, intakeAnswers, promoCode, email: promoEmail } = input;

  const emailAddr = (promoEmail || intakeAnswers.email) as string | undefined;
  if (!emailAddr) {
    return NextResponse.json({ error: "Email is required for promo orders" }, { status: 400 });
  }

  await orderRepo.update(supabase, orderId, {
    amount_total: 0, ev_cut: 0, partner_cut: 0, attorney_cut: 0,
    status: "generating",
    attorney_review_requested: false,
  });

  let profileId = userId;
  const { generateTempPassword } = await import("@/lib/utils/generate-password");
  const tempPassword = generateTempPassword();

  if (!profileId) {
    const { data: existingUser } = await profileRepo.findIdByEmail(supabase, emailAddr);
    if (existingUser) {
      profileId = existingUser.id;
      await supabase.auth.admin.updateUserById(existingUser.id, { password: tempPassword });
    } else {
      const fullName = `${(intakeAnswers.firstName as string) || ""} ${(intakeAnswers.lastName as string) || ""}`.trim();
      const { data: authMatch } = await supabase
        .rpc("find_auth_user_by_email", { lookup_email: emailAddr })
        .returns<{ id: string; email: string }[]>()
        .maybeSingle();

      if (authMatch) {
        profileId = authMatch.id;
        await supabase.auth.admin.updateUserById(authMatch.id, { password: tempPassword });
        await profileRepo.upsert(supabase, {
          id: authMatch.id,
          email: emailAddr,
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
        if (newUser?.user) {
          profileId = newUser.user.id;
          await profileRepo.upsert(supabase, {
            id: newUser.user.id,
            email: emailAddr,
            full_name: fullName,
            user_type: "client",
          });
        } else if (createErr) {
          console.error("Failed to create auth user:", createErr.message);
        }
      }
    }
    if (profileId) {
      await clientRepo.setProfileId(supabase, clientId, profileId);
    }
  }

  await documentRepo.insertMany(
    supabase,
    config.docTypes.map((dt) => ({
      order_id: orderId,
      document_type: dt,
      status: "pending",
      template_version: "1.0",
    })),
  );

  await supabase.from("audit_log").insert({
    actor_id: profileId || null,
    action: "checkout.promo_free",
    resource_type: "order",
    resource_id: orderId,
    metadata: { product_type: config.productType, promo_code: promoCode, email: emailAddr },
  });

  return NextResponse.json({ free: true, orderId, email: emailAddr, userId: profileId });
}
