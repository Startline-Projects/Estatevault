import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: partner } = await admin.from("partners").select("company_name, product_name, business_url, accent_color").eq("profile_id", user.id).single();
  const { data: profile } = await admin.from("profiles").select("full_name, email, phone").eq("id", user.id).single();

  const c = partner?.company_name || "Your Company";
  const p = partner?.product_name || "Legacy Protection";
  const url = partner?.business_url ? `legacy.${partner.business_url}` : "estatevault.com";
  const accent = partner?.accent_color || "#C9A84C";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: letter; margin: 0; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 48px; color: #2D2D2D; }
  .header { text-align: center; padding-bottom: 24px; border-bottom: 3px solid ${accent}; }
  .header h1 { color: #1C3557; font-size: 28px; margin: 0; }
  .header p { color: #666; font-size: 14px; margin: 8px 0 0; }
  .packages { display: flex; gap: 24px; margin: 32px 0; }
  .package { flex: 1; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px; }
  .package h3 { color: #1C3557; margin: 0 0 4px; }
  .package .price { font-size: 28px; font-weight: bold; color: #1C3557; }
  .package ul { padding-left: 16px; margin: 16px 0 0; }
  .package li { font-size: 13px; margin: 6px 0; color: #555; }
  .cta { text-align: center; margin: 32px 0; padding: 24px; background: #1C3557; border-radius: 12px; color: white; }
  .cta h2 { margin: 0; font-size: 20px; }
  .cta .url { color: ${accent}; font-size: 18px; font-weight: bold; margin-top: 8px; }
  .contact { text-align: center; margin-top: 24px; font-size: 13px; color: #666; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; text-align: center; }
</style></head><body>
<div class="header">
  <h1>${c}</h1>
  <p>PROTECT YOUR FAMILY'S FUTURE — Attorney-Reviewed Estate Planning</p>
</div>
<div class="packages">
  <div class="package">
    <h3>Will Package</h3>
    <div class="price">$400</div>
    <ul>
      <li>✓ Last Will & Testament</li>
      <li>✓ Power of Attorney</li>
      <li>✓ Healthcare Directive</li>
      <li>✓ Execution Guide</li>
      <li>✓ Family Vault Access</li>
    </ul>
  </div>
  <div class="package" style="border-color: ${accent};">
    <h3>Trust Package</h3>
    <div class="price">$600</div>
    <ul>
      <li>✓ Revocable Living Trust</li>
      <li>✓ Pour-Over Will</li>
      <li>✓ Power of Attorney</li>
      <li>✓ Healthcare Directive</li>
      <li>✓ Asset Funding Checklist</li>
      <li>✓ Family Vault Access</li>
    </ul>
  </div>
</div>
<div class="cta">
  <h2>Get started in 15 minutes</h2>
  <div class="url">${url}</div>
</div>
<div class="contact">
  ${profile?.full_name || ""} | ${c}<br>
  ${profile?.phone || ""} | ${profile?.email || ""}
</div>
<div class="footer">
  <p>Powered by EstateVault | This platform provides document preparation services only. It does not provide legal advice.</p>
</div>
</body></html>`;

  await admin.from("audit_log").insert({ actor_id: user.id, action: "marketing.download", metadata: { asset_type: "flyer" } });

  return new NextResponse(html, { headers: { "Content-Type": "text/html", "Content-Disposition": `inline; filename="client-flyer.html"` } });
}
