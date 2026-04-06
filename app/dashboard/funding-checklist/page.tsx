"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const ASSET_DETAILS: Record<string, { instruction: string; details: string }> = {
  "Primary home / real estate in Michigan": {
    instruction: "Transfer via Michigan Quit Claim Deed",
    details: "File a Quit Claim Deed transferring your property from your name to your trust. Record it with your county Register of Deeds. This does not trigger reassessment of property taxes in Michigan.",
  },
  "Real estate in another state": {
    instruction: "Transfer deed in each applicable state",
    details: "Each state has its own deed requirements. Consult with an attorney in that state or use a title company to ensure proper transfer. This avoids ancillary probate in that state.",
  },
  "Bank and investment accounts": {
    instruction: "Contact your bank to retitle accounts",
    details: "Call your bank and request to retitle your accounts in the name of your trust. They will provide their specific forms. Example: 'John Smith, Trustee of the John Smith Revocable Living Trust.'",
  },
  "Business interests": {
    instruction: "Assign business interests to your trust",
    details: "For LLCs, amend your operating agreement to reflect the trust as a member. For corporations, transfer stock certificates. Consult with your business attorney to ensure proper transfer.",
  },
  "Vehicles": {
    instruction: "Michigan title transfer required",
    details: "Visit your local Secretary of State office to transfer your vehicle title to your trust. Bring your trust certificate and current title. Update your insurance to reflect the trust as the named insured.",
  },
  "Personal property and valuables": {
    instruction: "Sign an Assignment of Personal Property",
    details: "Your trust package includes a general assignment of personal property. Sign this document to transfer ownership of furniture, jewelry, artwork, and other personal items to your trust.",
  },
  "Digital assets and cryptocurrency": {
    instruction: "Update beneficiary designations and access",
    details: "For cryptocurrency: transfer to a wallet owned by the trust, or name the trust as beneficiary. For digital accounts: store access credentials in your vault and set memorial/legacy contacts where available.",
  },
};

export default function FundingChecklistPage() {
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [assetTypes, setAssetTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: client } = await supabase.from("clients").select("id, funding_checklist").eq("profile_id", user.id).single();
      if (!client) { setLoading(false); return; }

      if (client.funding_checklist && typeof client.funding_checklist === "object") {
        setChecklist(client.funding_checklist as Record<string, boolean>);
      }

      // Get asset types from latest trust quiz session
      const { data: quiz } = await supabase.from("quiz_sessions").select("answers").eq("client_id", client.id).eq("recommendation", "trust").order("created_at", { ascending: false }).limit(1).single();

      if (quiz?.answers) {
        const answers = quiz.answers as Record<string, unknown>;
        setAssetTypes((answers.assetTypes as string[]) || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function toggleItem(asset: string) {
    const updated = { ...checklist, [asset]: !checklist[asset] };
    setChecklist(updated);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("clients").update({ funding_checklist: updated }).eq("profile_id", user.id);
  }

  if (loading) return <div className="py-20 text-center text-charcoal/50">Loading...</div>;

  if (assetTypes.length === 0) {
    return (
      <div className="max-w-2xl text-center py-16">
        <span className="text-4xl">📋</span>
        <p className="mt-4 text-sm text-charcoal/50">No funding checklist available. This is for trust clients only.</p>
      </div>
    );
  }

  const allComplete = assetTypes.every((a) => checklist[a]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy">Fund Your Trust</h1>
      <p className="mt-1 text-sm text-charcoal/60">Your trust only protects what&apos;s inside it. Check off each asset as you transfer it.</p>

      {allComplete && (
        <div className="mt-6 rounded-xl bg-green-50 border border-green-200 p-6 text-center">
          <span className="text-3xl">🎉</span>
          <p className="mt-2 text-sm font-semibold text-green-800">Your trust is fully funded. Your family is protected.</p>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {assetTypes.map((asset) => {
          const detail = ASSET_DETAILS[asset];
          const isExpanded = expandedItem === asset;
          return (
            <div key={asset} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <input type="checkbox" checked={!!checklist[asset]} onChange={() => toggleItem(asset)} className="mt-1 h-5 w-5 rounded accent-gold" />
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${checklist[asset] ? "text-charcoal/60 line-through" : "text-navy"}`}>
                    {asset.split(" / ")[0]}
                  </p>
                  <p className="text-xs text-charcoal/50 mt-1">{detail?.instruction || "See instructions"}</p>
                  {detail?.details && (
                    <button onClick={() => setExpandedItem(isExpanded ? null : asset)} className="mt-2 text-xs text-gold hover:text-gold/80">
                      {isExpanded ? "Hide details" : "Learn more →"}
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && detail?.details && (
                <div className="px-5 pb-5 pl-14">
                  <p className="text-xs text-charcoal/60 leading-relaxed">{detail.details}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
