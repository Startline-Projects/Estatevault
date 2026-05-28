import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { partnerVaultClientCheckoutSchema } from "@/lib/validation/schemas";
import { stripe } from "@/lib/stripe";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import { PRICES } from "@/lib/orders/pricing";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = partnerVaultClientCheckoutSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { clientEmail, clientName, tempPassword, pin } = parsed.data;

  const normalizedEmail = clientEmail.trim().toLowerCase();

  const { data: partner } = await partnerRepo.getVaultCheckoutInfoByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("Partner not found.", 404);
  if (partner.tier !== "basic") return fail("This feature is for basic tier partners only.", 403);

  const { data: existingProfile } = await profileRepo.findByEmail(auth.admin, normalizedEmail);
  if (existingProfile) return fail("An account with this email already exists.", 409);

  const { data: createdUser, error: createErr } = await auth.admin.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: clientName.trim(), user_type: "client" },
  });
  if (createErr || !createdUser?.user?.id) return fail("Failed to create client account.", 500);

  const clientUserId = createdUser.user.id;

  await profileRepo.upsert(auth.admin, {
    id: clientUserId,
    email: normalizedEmail,
    full_name: clientName.trim(),
    user_type: "client",
  });

  const pinHash = await bcrypt.hash(pin, 10);
  await auth.admin.from("profiles").update({ vault_pin_hash: pinHash }).eq("id", clientUserId);

  const { data: clientRecord } = await auth.admin
    .from("clients")
    .insert({ profile_id: clientUserId, partner_id: partner.id, source: "partner" })
    .select("id")
    .single();

  const clientId = clientRecord?.id ?? "";
  const origin = req.headers.get("origin") || "https://www.estatevault.us";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: auth.user.email || undefined,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `Vault — ${clientName.trim()}`,
          description: `Annual vault subscription for ${normalizedEmail}`,
        },
        unit_amount: PRICES.vaultSubscriptionYear,
        recurring: { interval: "year" },
      },
      quantity: 1,
    }],
    success_url: `${origin}/pro/vault-clients/success?setup=1`,
    cancel_url: `${origin}/pro/vault-clients/new`,
    metadata: {
      product_type: "vault_subscription",
      client_id: clientId,
      user_id: clientUserId,
      partner_id: partner.id,
      paid_by_partner: "true",
    },
  });

  return ok({ url: session.url });
});
