import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DocumentActions from "@/components/dashboard/DocumentActions";
import PackageStatusCard from "@/components/dashboard/PackageStatusCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function CompletionRing({ percent }: { percent: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#C9A84C" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <span className="absolute text-2xl font-bold text-navy">{percent}%</span>
    </div>
  );
}

export default async function DashboardHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const { data: client } = await supabase.from("clients").select("id, documents_executed, funding_checklist").eq("profile_id", user.id).single();

  let orders: Array<{ id: string; product_type: string; status: string; created_at: string; attorney_review_requested: boolean }> = [];
  let documents: Array<{ id: string; document_type: string; status: string }> = [];
  let vaultCount = 0;
  let isTrustClient = false;
  let fundingComplete = false;

  if (client) {
    const { data: o } = await supabase.from("orders").select("id, product_type, status, created_at, attorney_review_requested").eq("client_id", client.id).order("created_at", { ascending: false });
    orders = o || [];
    isTrustClient = orders.some((o) => o.product_type === "trust");

    const { data: d } = await supabase.from("documents").select("id, document_type, status").eq("client_id", client.id);
    documents = d || [];

    const { data: v } = await supabase.from("vault_items").select("id").eq("client_id", client.id);
    vaultCount = v?.length || 0;

    if (client.funding_checklist && typeof client.funding_checklist === "object") {
      const checklist = client.funding_checklist as Record<string, boolean>;
      const values = Object.values(checklist);
      fundingComplete = values.length > 0 && values.every(Boolean);
    }
  }

  // Completion tracking
  const hasPurchased = orders.length > 0;
  const docsExecuted = client?.documents_executed || false;
  const vaultPopulated = vaultCount >= 3;

  const actions = [
    { label: "Documents purchased", done: hasPurchased },
    { label: "Documents executed (signed)", done: docsExecuted },
    { label: "Vault populated", done: vaultPopulated },
  ];
  if (isTrustClient) {
    actions.push({ label: "Assets funded", done: fundingComplete });
  }

  const completedCount = actions.filter((a) => a.done).length;
  const percent = Math.round((completedCount / actions.length) * 100);

  // Next action logic
  let nextAction = { title: "", description: "", buttonText: "", href: "" };
  if (!docsExecuted) {
    nextAction = { title: "Sign your documents", description: "Follow the execution guide to properly sign and witness your documents.", buttonText: "View Execution Guide", href: "/dashboard/documents" };
  } else if (!vaultPopulated) {
    nextAction = { title: "Set up your vault", description: "Add your important accounts, policies, and contacts to your family vault.", buttonText: "Go to My Vault", href: "/dashboard/vault" };
  } else if (isTrustClient && !fundingComplete) {
    nextAction = { title: "Fund your trust", description: "Transfer your assets into your trust to complete your protection.", buttonText: "View Funding Checklist", href: "/dashboard/funding-checklist" };
  } else {
    nextAction = { title: "Your plan is complete", description: "Review your plan annually to keep it up to date.", buttonText: "Review My Plan", href: "/dashboard/life-events" };
  }

  // Check if account is 12+ months old
  const accountAge = orders.length > 0 ? (Date.now() - new Date(orders[orders.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
  const showAnnualReview = accountAge >= 1;

  const latestOrder = orders[0];
  const packageName = latestOrder?.product_type === "trust" ? "Trust Package" : "Will Package";


  return (
    <div className="max-w-4xl">
      {/* Welcome banner */}
      <div className="rounded-xl bg-navy p-6 border-l-4 border-gold">
        <h1 className="text-xl font-bold text-white">
          {hasPurchased ? `Welcome back, ${firstName}.` : `Welcome, ${firstName}. Your estate plan is ready.`}
        </h1>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Completion ring */}
        <div className="rounded-xl bg-white border border-gray-200 p-6 text-center">
          <CompletionRing percent={percent} />
          <p className="mt-4 text-sm font-semibold text-navy">Plan Completion</p>
          <div className="mt-4 space-y-2 text-left">
            {actions.map((a) => (
              <div key={a.label} className="flex items-center gap-2 text-sm">
                <span>{a.done ? "✅" : "⬜"}</span>
                <span className={a.done ? "text-charcoal" : "text-charcoal/50"}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next action */}
        <div className="rounded-xl bg-white border border-gray-200 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-gold">Next Step</p>
          <h2 className="mt-2 text-lg font-bold text-navy">{nextAction.title}</h2>
          <p className="mt-2 text-sm text-charcoal/60">{nextAction.description}</p>
          <Link href={nextAction.href} className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">
            {nextAction.buttonText}
          </Link>
        </div>
      </div>

      {/* Documents summary */}
      {latestOrder && (
        <PackageStatusCard
          orderId={latestOrder.id}
          packageName={packageName}
          initialOrderStatus={latestOrder.status}
          initialDocuments={documents.map((d) => ({ type: d.document_type, status: d.status }))}
        />
      )}

      {/* Document downloads + email + generation status */}
      {latestOrder && (
        <div className="mt-4">
          <DocumentActions
            orderId={latestOrder.id}
            productType={latestOrder.product_type}
            orderStatus={latestOrder.status}
          />
        </div>
      )}

      {/* Annual review banner */}
      {showAnnualReview && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-6">
          <p className="text-sm font-semibold text-amber-800">It&apos;s been a year since your estate plan was created. Life changes, your plan should too.</p>
          <Link href="/dashboard/life-events" className="mt-3 inline-flex items-center rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
            Review My Plan
          </Link>
        </div>
      )}
    </div>
  );
}
