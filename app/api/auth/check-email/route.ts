import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authCheckEmailSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authCheckEmailSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) return fail("Email is required.", 400);

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!profile) return ok({ exists: false });

  const { data: client } = await admin
    .from("clients")
    .select("id, vault_subscription_status")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const hasVault = client?.vault_subscription_status === "active";

  let hasWill = false;
  let hasTrust = false;
  if (client?.id) {
    const { data: orders } = await admin
      .from("orders")
      .select("product_type")
      .eq("client_id", client.id);
    hasWill = !!orders?.some((o) => o.product_type === "will");
    hasTrust = !!orders?.some((o) => o.product_type === "trust");
  }

  return ok({
    exists: true,
    fullName: profile.full_name || null,
    hasWill,
    hasTrust,
    hasVault,
  });
});
