import { NextRequest } from "next/server";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesCreatePartnerSchema } from "@/lib/validation/schemas";
import { partnerUrl, normalizeBusinessDomain } from "@/lib/hosts";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { PROMO_CODES } from "@/lib/orders/pricing";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = salesCreatePartnerSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { companyName, ownerName, email, businessUrl, phone, state, professionalType, tier, source, notes, promoCode, partnerRevenuePct } = parsed.data;

  const cleanBusinessUrl = businessUrl ? normalizeBusinessDomain(businessUrl) : "";
  const urlForSlug = cleanBusinessUrl || companyName;
  const slug = urlForSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: existingPartner } = await partnerRepo.findBySlug(auth.admin, slug);
  if (existingPartner) return fail("A partner with this business URL already exists.", 409);

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  const bytes = randomBytes(12);
  let tempPassword = "";
  for (let i = 0; i < 12; i++) tempPassword += chars[bytes[i] % chars.length];

  const { data: existingProfile } = await profileRepo.findByEmail(auth.admin, email);
  let userId: string;

  if (existingProfile) {
    if (["sales_rep", "admin"].includes(existingProfile.user_type)) {
      return fail("This email belongs to an internal account and cannot be used for a partner.", 409);
    }
    userId = existingProfile.id;
    await auth.admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      user_metadata: { full_name: ownerName, user_type: "partner" },
    });
  } else {
    const { data: newUser, error: createErr } = await auth.admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerName, user_type: "partner" },
    });
    if (createErr || !newUser.user) return fail("Failed to create user", 500);
    userId = newUser.user.id;
  }

  await auth.admin.auth.admin.updateUserById(userId, { password: tempPassword });

  const { data: profileCheck } = await auth.admin.from("profiles").select("id").eq("id", userId).single();
  if (!profileCheck) {
    await profileRepo.upsert(auth.admin, { id: userId, email, full_name: ownerName, user_type: "partner", phone, state: state || "Michigan" });
  } else {
    await auth.admin.from("profiles").update({ user_type: "partner", full_name: ownerName, phone }).eq("id", userId);
  }

  const upperPromo = promoCode?.toUpperCase() as keyof typeof PROMO_CODES | undefined;
  const validPromo = upperPromo && upperPromo in PROMO_CODES ? upperPromo : null;

  const { data: partner, error: partnerErr } = await auth.admin.from("partners").insert({
    profile_id: userId,
    company_name: companyName,
    business_url: businessUrl || "",
    tier: tier || "standard",
    status: "onboarding",
    partner_slug: slug,
    created_by: auth.user.id,
    created_by_notes: notes || null,
    prospect_source: source || null,
    partner_revenue_pct: partnerRevenuePct || 0,
    ...(validPromo ? { promo_code: validPromo, one_time_fee_paid: true, onboarding_step: 2 } : {}),
  }).select("id").single();

  if (partnerErr || !partner) return fail("Failed to create partner", 500);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "partner.created",
    resource_type: "partner",
    resource_id: partner.id,
    metadata: { company_name: companyName, tier, source, professional_type: professionalType },
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const isBasic = tier === "basic";
    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: email,
      subject: isBasic
        ? "Welcome to EstateVault — Your White-Label Vault Account"
        : "Welcome to EstateVault, Your Partner Account",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #1C3557; font-size: 24px;">Welcome to EstateVault</h1>
          <p style="color: #2D2D2D; line-height: 1.6;">Hi ${ownerName},</p>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Your ${isBasic ? "White-Label Vault" : "partner"} account for <strong>${companyName}</strong> has been created.
            ${isBasic
              ? "Complete onboarding to brand your vault and get your custom subdomain."
              : "Use the credentials below to sign in and complete your onboarding:"
            }
          </p>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Email</p>
            <p style="margin: 0 0 16px 0; color: #1C3557; font-weight: 600;">${email}</p>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Temporary Password</p>
            <p style="margin: 0; color: #1C3557; font-weight: 600; font-family: monospace; font-size: 18px;">${tempPassword}</p>
          </div>
          <a href="${partnerUrl("/auth/login")}"
             style="display: block; text-align: center; background: #C9A84C; color: white; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-weight: 600; font-size: 14px;">
            Sign In to Your Account
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
            Please change your password after signing in.
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error("Partner welcome email failed:", emailErr);
  }

  return ok({ partnerId: partner.id, email, slug });
});
