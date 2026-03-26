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
  body { font-family: Arial, sans-serif; margin: 40px; color: #2D2D2D; line-height: 1.5; }
  .header { border-bottom: 3px solid ${accent}; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #1C3557; margin: 0; font-size: 22px; }
  .header p { color: #666; margin: 4px 0 0; font-size: 13px; }
  h2 { color: #1C3557; font-size: 16px; margin: 24px 0 8px; }
  .two-col { display: flex; gap: 24px; }
  .col { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
  .col h3 { color: #1C3557; margin: 0 0 4px; font-size: 15px; }
  .col .price { font-size: 24px; font-weight: bold; color: #1C3557; }
  .col li { font-size: 12px; margin: 4px 0; color: #555; }
  .steps { display: flex; gap: 16px; margin: 16px 0; }
  .step { flex: 1; text-align: center; }
  .step .num { width: 32px; height: 32px; border-radius: 50%; background: ${accent}; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
  .step p { font-size: 12px; margin: 8px 0 0; color: #555; }
  .vault { background: #1C3557; color: white; border-radius: 8px; padding: 16px; margin: 24px 0; }
  .vault h3 { margin: 0; font-size: 14px; }
  .vault p { font-size: 12px; margin: 8px 0 0; color: rgba(255,255,255,0.7); }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
</style></head><body>
<div class="header">
  <h1>${c} — ${p}</h1>
  <p>Attorney-Reviewed Estate Planning</p>
</div>

<h2>What is ${p}?</h2>
<p style="font-size:13px;">A simple, affordable way to create attorney-reviewed estate planning documents — a will or revocable living trust — in about 15 minutes. Documents are specific to Michigan and include everything your family needs.</p>

<h2>What's Included</h2>
<div class="two-col">
  <div class="col">
    <h3>Will Package</h3>
    <div class="price">$400</div>
    <ul style="padding-left:16px;">
      <li>Last Will & Testament</li><li>Power of Attorney</li><li>Healthcare Directive</li><li>Execution Guide</li><li>Family Vault Access</li>
    </ul>
  </div>
  <div class="col" style="border-color:${accent};">
    <h3>Trust Package</h3>
    <div class="price">$600</div>
    <ul style="padding-left:16px;">
      <li>Revocable Living Trust</li><li>Pour-Over Will</li><li>Power of Attorney</li><li>Healthcare Directive</li><li>Asset Funding Checklist</li><li>Family Vault Access</li>
    </ul>
  </div>
</div>

<div class="vault">
  <h3>The Family Vault</h3>
  <p>A secure encrypted space to store estate documents, insurance policies, financial accounts, and digital credentials — everything your family needs in one place.</p>
</div>

<h2>How to Get Started</h2>
<div class="steps">
  <div class="step"><div class="num">1</div><p>Take a 5-min quiz</p></div>
  <div class="step"><div class="num">2</div><p>Complete intake (10 min)</p></div>
  <div class="step"><div class="num">3</div><p>Receive documents</p></div>
</div>

<p style="text-align:center;font-size:16px;font-weight:bold;color:#1C3557;margin:24px 0;">Get started: <span style="color:${accent};">${url}</span></p>

<div class="footer">
  <p>${profile?.full_name || ""} | ${c} | ${profile?.phone || ""} | ${profile?.email || ""}</p>
  <p>Powered by EstateVault. This platform provides document preparation services only. It does not provide legal advice.</p>
</div>
</body></html>`;

  await admin.from("audit_log").insert({ actor_id: user.id, action: "marketing.download", metadata: { asset_type: "one_pager" } });

  return new NextResponse(html, { headers: { "Content-Type": "text/html", "Content-Disposition": `inline; filename="client-one-pager.html"` } });
}
