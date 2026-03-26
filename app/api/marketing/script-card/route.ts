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
  const { data: partner } = await admin.from("partners").select("company_name, product_name, accent_color").eq("profile_id", user.id).single();

  const companyName = partner?.company_name || "Your Company";
  const productName = partner?.product_name || "Legacy Protection";

  // Generate a simple HTML-based PDF using browser print
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #2D2D2D; line-height: 1.6; }
  h1 { color: #1C3557; font-size: 20px; border-bottom: 2px solid #C9A84C; padding-bottom: 8px; }
  h2 { color: #1C3557; font-size: 16px; margin-top: 24px; }
  .company { font-size: 14px; color: #1C3557; font-weight: bold; margin-bottom: 4px; }
  .badge { display: inline-block; background: #C9A84C; color: white; padding: 2px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; }
  .script-box { background: #f8f9fa; border: 1px solid #e5e5e5; padding: 16px; border-radius: 8px; margin: 12px 0; font-style: italic; }
  .never { color: #dc2626; font-weight: bold; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
</style></head><body>
<p class="company">${companyName}</p>
<p class="badge">COMPLIANCE SCRIPT CARD</p>
<h1>Approved Scripts for Estate Planning Conversations</h1>

<h2>Introduction Script (use word-for-word)</h2>
<div class="script-box">
"[Client name], one thing I want to make sure we cover today is your estate plan. A lot of my clients have been using a platform called ${productName} to get their wills and trusts done quickly and affordably. It generates attorney-reviewed documents — takes about 15 minutes. Would you like me to walk you through it?"
</div>

<h2>If they ask "Are you my lawyer?"</h2>
<div class="script-box">
"No — I'm not acting as your attorney, and this platform doesn't provide legal advice. What it does is generate attorney-reviewed estate planning documents based on your answers. If you have complex legal questions, we can connect you with a licensed estate planning attorney."
</div>

<h2>If they ask "Is this legitimate?"</h2>
<div class="script-box">
"Yes — all documents are based on attorney-approved templates specific to Michigan. They're the same documents an estate planning attorney would prepare, at a fraction of the cost."
</div>

<h2 class="never">NEVER SAY:</h2>
<ul>
<li class="never">✗ "I recommend you get a trust"</li>
<li class="never">✗ "You should do this"</li>
<li class="never">✗ "As your advisor I think you need..."</li>
<li class="never">✗ "This is legal advice"</li>
<li class="never">✗ "I'm helping you with your legal plan"</li>
</ul>

<div class="footer">
<p>${companyName} | Powered by EstateVault</p>
<p>This platform provides document preparation services only. It does not provide legal advice.</p>
</div>
</body></html>`;

  // Log download
  await admin.from("audit_log").insert({ actor_id: user.id, action: "marketing.download", metadata: { asset_type: "script_card" } });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="compliance-script-card.html"`,
    },
  });
}
