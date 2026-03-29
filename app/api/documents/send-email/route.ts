import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    // Get client and their documents
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { data: latestOrder } = await admin
      .from("orders")
      .select("id, product_type")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestOrder) return NextResponse.json({ error: "No orders found" }, { status: 400 });

    const { data: documents } = await admin
      .from("documents")
      .select("document_type, storage_path")
      .eq("order_id", latestOrder.id)
      .not("storage_path", "is", null);

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: "Documents not ready yet" }, { status: 400 });
    }

    // Generate signed URLs for each document
    const docLinks = await Promise.all(
      documents.map(async (doc) => {
        const { data } = await admin.storage
          .from("documents")
          .createSignedUrl(doc.storage_path!, 3600); // 1 hour
        const labels: Record<string, string> = {
          will: "Last Will & Testament",
          trust: "Revocable Living Trust",
          pour_over_will: "Pour-Over Will",
          poa: "Durable Power of Attorney",
          healthcare_directive: "Healthcare Directive",
        };
        return {
          name: labels[doc.document_type] || doc.document_type,
          url: data?.signedUrl || "",
        };
      })
    );

    const validLinks = docLinks.filter((l) => l.url);
    if (validLinks.length === 0) {
      return NextResponse.json({ error: "Failed to generate download links" }, { status: 500 });
    }

    const packageName = latestOrder.product_type === "trust" ? "Trust Package" : "Will Package";
    const linkHtml = validLinks
      .map((l) => `<p style="margin:8px 0;"><a href="${l.url}" style="color:#1C3557;font-weight:600;text-decoration:underline;">${l.name}</a></p>`)
      .join("");

    // Send email
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: user.email!,
      subject: `Your ${packageName} Documents`,
      html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1C3557;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;font-size:20px;margin:0;">EstateVault</h1>
        </div>
        <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="color:#1C3557;font-size:20px;">Your ${packageName}</h2>
          <p style="color:#2D2D2D;line-height:1.6;">Here are your document download links. These links expire in 1 hour for security.</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:24px 0;">
            ${linkHtml}
          </div>
          <p style="color:#666;font-size:13px;">You can also access your documents anytime by signing in to your account at <a href="https://www.estatevault.us/auth/login" style="color:#1C3557;">estatevault.us</a>.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">This platform provides document preparation services only. It does not provide legal advice.</p>
        </div>
      </div>`,
    });

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "documents.emailed",
      resource_type: "order",
      resource_id: latestOrder.id,
      metadata: { email: user.email, documents_count: validLinks.length },
    });

    return NextResponse.json({ success: true, email: user.email });
  } catch (error) {
    console.error("Send documents email error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
