"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type TrustIntake, initialTrustIntake, checkComplexity } from "@/lib/trust-types";
import AcknowledgmentCard from "@/components/intake/AcknowledgmentCard";
import ChoiceTile from "@/components/quiz/ChoiceTile";
import YesNoTiles from "@/components/quiz/YesNoTiles";
import TextInput from "@/components/quiz/TextInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";

type Stage = "loading" | "acknowledgment" | "intake" | "redirecting";

const ASSET_OPTIONS = [
  "Primary home / real estate in Michigan",
  "Real estate in another state",
  "Bank and investment accounts",
  "Business interests",
  "Vehicles",
  "Personal property and valuables",
  "Digital assets and cryptocurrency",
];

const ALL_POA_POWERS = [
  "Banking and finances",
  "Real estate transactions",
  "Business operations",
  "Tax filings",
];

const relOptions = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Friend", "Other"];
const benRelOptions = ["Spouse/Partner", "Child", "Parent", "Sibling", "Other"];
const execRelOptions = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Other"];

export default function TrustPage() {
  const router = useRouter();
  const [partnerParam, setPartnerParam] = useState("");
  const [stage, setStage] = useState<Stage>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [intake, setIntake] = useState<TrustIntake>(initialTrustIntake);
  const [currentCard, setCurrentCard] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [hasMinorChildren, setHasMinorChildren] = useState(false);

  const update = useCallback(
    (updates: Partial<TrustIntake>) => setIntake((prev) => ({ ...prev, ...updates })),
    []
  );

  useEffect(() => {
    async function init() {
      setPartnerParam(new URLSearchParams(window.location.search).get("partner") || "");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        try {
          const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
          if (client) {
            const { data: quiz } = await supabase.from("quiz_sessions").select("answers").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1).single();
            if (quiz?.answers) {
              const a = quiz.answers as Record<string, string>;
              if (a.financeManager) update({ poaAgentName: a.financeManager });
              if (a.medicalDecisionMaker) update({ patientAdvocateName: a.medicalDecisionMaker });
              if (a.childGuardian && a.childGuardian !== "N/A") {
                update({ guardianName: a.childGuardian });
                setHasMinorChildren(true);
              }
              if (a.hasChildren === "Yes") setHasMinorChildren(true);
            }
          }
        } catch { /* no quiz data */ }
      }
      setStage("acknowledgment");
    }
    init();
  }, [update]);

  // Card IDs
  type CardId = "about" | "trustee" | "beneficiaries" | "guardian" | "assets" | "pourover" | "poa" | "healthcare" | "gifts" | "review";

  const visibleCards: CardId[] = ["about", "trustee", "beneficiaries"];
  if (hasMinorChildren) visibleCards.push("guardian");
  visibleCards.push("assets", "pourover", "poa", "healthcare", "gifts", "review");

  const totalCards = visibleCards.length;
  const safeIndex = Math.min(currentCard, totalCards - 1);
  const activeCardId = visibleCards[safeIndex];
  const progress = ((safeIndex + 1) / totalCards) * 100;

  function isCardComplete(): boolean {
    switch (activeCardId) {
      case "about":
        return intake.firstName.trim() !== "" && intake.lastName.trim() !== "" && intake.dateOfBirth !== "" && intake.city.trim() !== "";
      case "trustee":
        return intake.primaryTrustee !== "" && (intake.primaryTrustee === "Myself" || intake.trusteeName.trim() !== "") && intake.successorTrusteeName.trim() !== "" && intake.successorTrusteeRelationship !== "";
      case "beneficiaries": {
        const base = intake.primaryBeneficiaryName.trim() !== "" && intake.primaryBeneficiaryRelationship !== "" && intake.hasSecondBeneficiary !== "" && intake.hasContingentBeneficiary !== "";
        if (!base) return false;
        if (intake.hasSecondBeneficiary === "Yes") {
          if (!intake.secondBeneficiaryName.trim() || !intake.secondBeneficiaryRelationship || !intake.estateSplit) return false;
          if (intake.estateSplit === "Other" && !intake.customSplit.trim()) return false;
        }
        if (intake.hasContingentBeneficiary === "Yes" && (intake.contingentBeneficiaries.length === 0 || intake.contingentBeneficiaries.some((b) => !b.name.trim() || !b.relationship))) return false;
        if (hasMinorChildren && !intake.distributionAge) return false;
        return true;
      }
      case "guardian":
        return intake.guardianName.trim() !== "" && intake.guardianRelationship !== "" && intake.successorGuardianName.trim() !== "";
      case "assets":
        return intake.assetTypes.length > 0;
      case "pourover":
        return intake.executorName.trim() !== "" && intake.executorRelationship !== "" && intake.successorExecutorName.trim() !== "";
      case "poa":
        return intake.poaAgentName.trim() !== "" && intake.poaAgentRelationship !== "" && intake.poaSuccessorAgentName.trim() !== "" && intake.poaPowers.length > 0;
      case "healthcare":
        return intake.patientAdvocateName.trim() !== "" && intake.patientAdvocateRelationship !== "" && intake.successorPatientAdvocateName.trim() !== "" && intake.organDonation !== "" && intake.hasHealthcareWishes !== "" && (intake.hasHealthcareWishes === "No" || intake.healthcareWishesDescription.trim() !== "");
      case "gifts":
        return intake.hasSpecificGifts !== "" && (intake.hasSpecificGifts === "No" || intake.specificGiftsDescription.trim() !== "");
      case "review":
        return true;
      default:
        return false;
    }
  }

  function animateTransition(dir: "forward" | "back", cb: () => void) {
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => { cb(); setAnimating(false); }, 300);
  }

  function handleContinue() {
    if (!isCardComplete()) return;
    if (activeCardId === "review") {
      const complexity = checkComplexity(intake);
      sessionStorage.setItem("trustIntake", JSON.stringify(intake));
      sessionStorage.setItem("trustUserId", userId || "");
      sessionStorage.setItem("trustComplexity", JSON.stringify(complexity));
      sessionStorage.setItem("trustPartner", partnerParam);
      setStage("redirecting");
      router.push("/trust/checkout");
      return;
    }
    animateTransition("forward", () => setCurrentCard((c) => c + 1));
  }

  function handleBack() {
    if (safeIndex <= 0) { setStage("acknowledgment"); return; }
    animateTransition("back", () => setCurrentCard((c) => c - 1));
  }

  useEffect(() => { if (currentCard >= totalCards) setCurrentCard(totalCards - 1); }, [totalCards, currentCard]);

  const slideClass = animating
    ? direction === "forward" ? "translate-x-[-100%] opacity-0" : "translate-x-[100%] opacity-0"
    : "translate-x-0 opacity-100";

  if (stage === "loading" || stage === "redirecting") {
    return (<div className="min-h-screen bg-navy flex items-center justify-center"><div className="animate-pulse text-gold text-xl font-bold">EstateVault</div></div>);
  }

  if (stage === "acknowledgment") {
    return <AcknowledgmentCard onContinue={() => setStage("intake")} />;
  }

  const moduleTitles: Record<CardId, string> = {
    about: "About You",
    trustee: "Your Trustee",
    beneficiaries: "Your Beneficiaries",
    guardian: "Minor Children & Guardian",
    assets: "Your Assets",
    pourover: "Your Pour-Over Will",
    poa: "Power of Attorney",
    healthcare: "Healthcare Directive",
    gifts: "Specific Gifts",
    review: "Final Review",
  };

  function toggleAsset(asset: string) {
    setIntake((prev) => ({
      ...prev,
      assetTypes: prev.assetTypes.includes(asset) ? prev.assetTypes.filter((a) => a !== asset) : [...prev.assetTypes, asset],
    }));
  }

  function togglePower(power: string) {
    if (power === "Banking and finances") return; // cannot uncheck
    if (power === "All of the above") {
      setIntake((prev) => ({ ...prev, poaPowers: [...ALL_POA_POWERS] }));
      return;
    }
    setIntake((prev) => ({
      ...prev,
      poaPowers: prev.poaPowers.includes(power) ? prev.poaPowers.filter((p) => p !== power) : [...prev.poaPowers, power],
    }));
  }

  function renderCard() {
    switch (activeCardId) {
      case "about":
        return (
          <>
            <QuestionLabel>First name</QuestionLabel>
            <TextInput value={intake.firstName} onChange={(v) => update({ firstName: v })} placeholder="First name" />
            <div className="mt-5"><QuestionLabel>Last name</QuestionLabel><TextInput value={intake.lastName} onChange={(v) => update({ lastName: v })} placeholder="Last name" /></div>
            <div className="mt-5"><QuestionLabel>Date of birth</QuestionLabel><input type="date" value={intake.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })} className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors" /></div>
            <div className="mt-5"><QuestionLabel>City of residence</QuestionLabel><TextInput value={intake.city} onChange={(v) => update({ city: v })} placeholder="e.g. Grand Rapids" /></div>
            <div className="mt-5">
              <QuestionLabel>Trust name (optional)</QuestionLabel>
              <p className="mb-2 text-xs text-charcoal/50">Leave blank to use the default: &quot;The [Your Name] Revocable Living Trust&quot;</p>
              <TextInput value={intake.trustName} onChange={(v) => update({ trustName: v })} placeholder={`e.g. The ${intake.firstName || "Smith"} Family Revocable Living Trust`} />
            </div>
          </>
        );

      case "trustee":
        return (
          <>
            <p className="mb-2 text-xs text-charcoal/60 leading-relaxed">Your trustee is responsible for managing the assets inside your trust. While you are alive and capable, you remain in full control as your own trustee.</p>
            <p className="mb-5 text-xs text-charcoal/50">Most people name <strong>Myself</strong> as the primary trustee. Your successor trustee automatically takes over only if you become incapacitated or pass away — they have no control during your lifetime.</p>
            <QuestionLabel>Who should serve as primary trustee?</QuestionLabel>
            <div className="grid grid-cols-2 gap-3">
              {["Myself", "Someone else"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.primaryTrustee === opt} onClick={() => update({ primaryTrustee: opt, ...(opt === "Myself" ? { trusteeName: "" } : {}) })} />))}
            </div>
            {intake.primaryTrustee === "Someone else" && (
              <div className="mt-5">
                <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                  <strong>Note:</strong> Naming someone other than yourself as primary trustee means they will manage trust assets immediately. Most people name themselves and rely on the successor trustee for continuity. Consider carefully before selecting this option.
                </div>
                <QuestionLabel>Trustee full name</QuestionLabel>
                <TextInput value={intake.trusteeName} onChange={(v) => update({ trusteeName: v })} placeholder="Full name" />
              </div>
            )}
            <div className="mt-5"><QuestionLabel>Successor trustee full name</QuestionLabel><p className="mb-2 text-xs text-charcoal/50">Who takes over if you are unable to serve?</p><TextInput value={intake.successorTrusteeName} onChange={(v) => update({ successorTrusteeName: v })} placeholder="Full name" /></div>
            <div className="mt-5"><QuestionLabel>Successor trustee relationship</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">{relOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.successorTrusteeRelationship === opt} onClick={() => update({ successorTrusteeRelationship: opt })} />))}</div>
            </div>
            <div className="mt-5"><QuestionLabel>Second successor trustee full name</QuestionLabel><p className="mb-2 text-xs text-charcoal/50">Optional backup — highly recommended</p><TextInput value={intake.secondSuccessorTrusteeName} onChange={(v) => update({ secondSuccessorTrusteeName: v })} placeholder="Full name (optional)" /></div>
          </>
        );

      case "beneficiaries":
        return (
          <>
            <QuestionLabel>Primary beneficiary full name</QuestionLabel>
            <TextInput value={intake.primaryBeneficiaryName} onChange={(v) => update({ primaryBeneficiaryName: v })} placeholder="Full name" />
            <div className="mt-5"><QuestionLabel>Relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{benRelOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.primaryBeneficiaryRelationship === opt} onClick={() => update({ primaryBeneficiaryRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Add another beneficiary?</QuestionLabel><YesNoTiles value={intake.hasSecondBeneficiary} onChange={(v) => update({ hasSecondBeneficiary: v, ...(v === "No" ? { secondBeneficiaryName: "", secondBeneficiaryRelationship: "", estateSplit: "", customSplit: "" } : {}) })} /></div>
            {intake.hasSecondBeneficiary === "Yes" && (
              <>
                <div className="mt-5"><QuestionLabel>Second beneficiary full name</QuestionLabel><TextInput value={intake.secondBeneficiaryName} onChange={(v) => update({ secondBeneficiaryName: v })} placeholder="Full name" /></div>
                <div className="mt-5"><QuestionLabel>Relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{benRelOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.secondBeneficiaryRelationship === opt} onClick={() => update({ secondBeneficiaryRelationship: opt })} />))}</div></div>
                <div className="mt-5"><QuestionLabel>Split equally between both beneficiaries?</QuestionLabel><div className="grid grid-cols-2 gap-3">{[{label: "Yes — equal split", val: "50/50"}, {label: "No — custom split", val: "Other"}].map(({label, val}) => (<ChoiceTile key={val} label={label} selected={val === "50/50" ? intake.estateSplit === "50/50" : intake.estateSplit !== "" && intake.estateSplit !== "50/50"} onClick={() => update({ estateSplit: val, ...(val === "50/50" ? { customSplit: "" } : {}) })} />))}</div>
                  {intake.estateSplit !== "" && intake.estateSplit !== "50/50" && <div className="mt-3"><p className="mb-2 text-xs text-charcoal/50">Enter percentage for each beneficiary (e.g. 70/30, 60/40)</p><TextInput value={intake.customSplit} onChange={(v) => update({ customSplit: v, estateSplit: v || "Other" })} placeholder="e.g. 70/30" /></div>}
                </div>
              </>
            )}
            {hasMinorChildren && (
              <div className="mt-5"><QuestionLabel>At what age should a minor beneficiary receive their full inheritance?</QuestionLabel><p className="mb-2 text-xs text-charcoal/50">Assets are held in trust until this age. Michigan law grants full rights at 18.</p><div className="grid grid-cols-4 gap-3">{["18", "21", "25", "30"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.distributionAge === opt} onClick={() => update({ distributionAge: opt })} />))}</div></div>
            )}
            {/* Contingent beneficiary */}
            <div className="mt-5">
              <QuestionLabel>Add a contingent beneficiary?</QuestionLabel>
              <p className="mb-3 text-xs text-charcoal/50">A contingent beneficiary inherits only if your primary beneficiary cannot. Example: your children inherit if your spouse passes before you.</p>
              <YesNoTiles value={intake.hasContingentBeneficiary} onChange={(v) => { update({ hasContingentBeneficiary: v }); if (v === "Yes" && intake.contingentBeneficiaries.length === 0) update({ contingentBeneficiaries: [{ name: "", relationship: "" }] }); if (v === "No") update({ contingentBeneficiaries: [] }); }} />
            </div>
            {intake.hasContingentBeneficiary === "Yes" && (
              <>
                {intake.contingentBeneficiaries.map((cb, idx) => (
                  <div key={idx} className="mt-5 rounded-lg bg-gray-50 p-4">
                    <QuestionLabel>Contingent beneficiary {idx + 1} full name</QuestionLabel>
                    <TextInput value={cb.name} onChange={(v) => { const u = [...intake.contingentBeneficiaries]; u[idx] = { ...u[idx], name: v }; update({ contingentBeneficiaries: u }); }} placeholder="Full name" />
                    <div className="mt-3"><QuestionLabel>Relationship</QuestionLabel>
                      <div className="grid grid-cols-2 gap-2">{["Child", "Parent", "Sibling", "Friend", "Charity/Organization", "Other"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={cb.relationship === opt} onClick={() => { const u = [...intake.contingentBeneficiaries]; u[idx] = { ...u[idx], relationship: opt }; update({ contingentBeneficiaries: u }); }} />))}</div>
                    </div>
                  </div>
                ))}
                {intake.contingentBeneficiaries.length < 3 && (
                  <button type="button" onClick={() => update({ contingentBeneficiaries: [...intake.contingentBeneficiaries, { name: "", relationship: "" }] })} className="mt-3 text-sm text-gold font-medium hover:text-gold/80">+ Add another contingent beneficiary</button>
                )}
              </>
            )}
          </>
        );

      case "guardian":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">This person would raise your children if something happened to you.</p>
            <QuestionLabel>Guardian full name</QuestionLabel><TextInput value={intake.guardianName} onChange={(v) => update({ guardianName: v })} placeholder="Full name" />
            <div className="mt-5"><QuestionLabel>Guardian relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{["Spouse/Partner", "Sibling", "Parent", "Friend", "Other"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.guardianRelationship === opt} onClick={() => update({ guardianRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Successor guardian full name</QuestionLabel><TextInput value={intake.successorGuardianName} onChange={(v) => update({ successorGuardianName: v })} placeholder="Full name" /></div>
          </>
        );

      case "assets":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">You don&apos;t need exact values — this helps us prepare the right provisions.</p>
            <QuestionLabel>What assets will go into your trust?</QuestionLabel>
            <div className="space-y-3">
              {ASSET_OPTIONS.map((asset) => (
                <button key={asset} type="button" onClick={() => toggleAsset(asset)}
                  className={`min-h-[44px] w-full rounded-xl border-2 px-5 py-3.5 text-left text-sm font-medium transition-all ${intake.assetTypes.includes(asset) ? "border-gold bg-gold/10 text-navy" : "border-gray-200 bg-white text-charcoal hover:border-gold/40"}`}>
                  <span className="mr-2">{intake.assetTypes.includes(asset) ? "☑" : "☐"}</span>{asset}
                </button>
              ))}
            </div>
            {intake.assetTypes.includes("Real estate in another state") && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                You have real estate in multiple states. Your trust will include provisions for this, and you may need separate deed transfers in each state. We&apos;ll note this in your asset funding checklist.
              </div>
            )}
            {intake.assetTypes.includes("Business interests") && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                Business interests in a trust require careful structuring. We recommend adding attorney review to ensure your business provisions are correctly drafted.
              </div>
            )}
          </>
        );

      case "pourover":
        return (
          <>
            <p className="mb-2 text-xs text-charcoal/60 leading-relaxed">Your Trust Package includes a Pour-Over Will.</p>
            <p className="mb-5 text-xs text-charcoal/50 leading-relaxed">A Pour-Over Will captures any assets not transferred into your trust during your lifetime and directs them into the trust after you pass.</p>
            <QuestionLabel>Who should carry out your Pour-Over Will?</QuestionLabel><TextInput value={intake.executorName} onChange={(v) => update({ executorName: v })} placeholder="Full name" />
            <div className="mt-5"><QuestionLabel>Executor relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{execRelOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.executorRelationship === opt} onClick={() => update({ executorRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Successor executor</QuestionLabel><TextInput value={intake.successorExecutorName} onChange={(v) => update({ successorExecutorName: v })} placeholder="Full name" /></div>
          </>
        );

      case "poa":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">This person manages your finances if you become incapacitated.</p>
            <QuestionLabel>Agent full name</QuestionLabel><TextInput value={intake.poaAgentName} onChange={(v) => update({ poaAgentName: v })} placeholder="Full name" />
            <div className="mt-5"><QuestionLabel>Agent relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{relOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.poaAgentRelationship === opt} onClick={() => update({ poaAgentRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Successor agent full name</QuestionLabel><TextInput value={intake.poaSuccessorAgentName} onChange={(v) => update({ poaSuccessorAgentName: v })} placeholder="Full name" /></div>
            <div className="mt-5"><QuestionLabel>Powers granted</QuestionLabel>
              <div className="space-y-3">
                {ALL_POA_POWERS.map((power) => (
                  <button key={power} type="button" onClick={() => togglePower(power)}
                    className={`min-h-[44px] w-full rounded-xl border-2 px-5 py-3.5 text-left text-sm font-medium transition-all ${intake.poaPowers.includes(power) ? "border-gold bg-gold/10 text-navy" : "border-gray-200 bg-white text-charcoal hover:border-gold/40"} ${power === "Banking and finances" ? "opacity-80" : ""}`}>
                    <span className="mr-2">{intake.poaPowers.includes(power) ? "☑" : "☐"}</span>{power}{power === "Banking and finances" ? " (required)" : ""}
                  </button>
                ))}
                <button type="button" onClick={() => togglePower("All of the above")}
                  className={`min-h-[44px] w-full rounded-xl border-2 px-5 py-3.5 text-left text-sm font-medium transition-all ${intake.poaPowers.length === ALL_POA_POWERS.length ? "border-gold bg-gold/10 text-navy" : "border-gray-200 bg-white text-charcoal hover:border-gold/40"}`}>
                  <span className="mr-2">{intake.poaPowers.length === ALL_POA_POWERS.length ? "☑" : "☐"}</span>All of the above
                </button>
              </div>
            </div>
          </>
        );

      case "healthcare":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">This person makes medical decisions for you if you cannot make them yourself.</p>
            <QuestionLabel>Patient advocate full name</QuestionLabel><TextInput value={intake.patientAdvocateName} onChange={(v) => update({ patientAdvocateName: v })} placeholder="Full name" />
            <div className="mt-5"><QuestionLabel>Relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{relOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.patientAdvocateRelationship === opt} onClick={() => update({ patientAdvocateRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Successor patient advocate</QuestionLabel><TextInput value={intake.successorPatientAdvocateName} onChange={(v) => update({ successorPatientAdvocateName: v })} placeholder="Full name" /></div>
            <div className="mt-5"><QuestionLabel>Do you wish to be an organ and tissue donor?</QuestionLabel><YesNoTiles value={intake.organDonation} onChange={(v) => update({ organDonation: v })} /></div>
            <div className="mt-5"><QuestionLabel>Do you have specific healthcare wishes to document?</QuestionLabel><YesNoTiles value={intake.hasHealthcareWishes} onChange={(v) => update({ hasHealthcareWishes: v, ...(v === "No" ? { healthcareWishesDescription: "" } : {}) })} /></div>
            {intake.hasHealthcareWishes === "Yes" && (
              <div className="mt-5">
                <textarea value={intake.healthcareWishesDescription} onChange={(e) => update({ healthcareWishesDescription: e.target.value })} placeholder="Example: I do not wish to be kept on life support if there is no reasonable chance of recovery." rows={4} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors resize-none" />
                <p className="mt-2 text-xs text-charcoal/60">This is your personal instruction — it guides your advocate&apos;s decisions.</p>
              </div>
            )}
          </>
        );

      case "gifts":
        return (
          <>
            <p className="mb-2 text-xs text-charcoal/60">For example: &quot;My grandmother&apos;s ring to my daughter Sarah&quot;</p>
            <QuestionLabel>Do you have any specific gifts you&apos;d like to leave?</QuestionLabel>
            <YesNoTiles value={intake.hasSpecificGifts} onChange={(v) => update({ hasSpecificGifts: v, ...(v === "No" ? { specificGiftsDescription: "" } : {}) })} />
            {intake.hasSpecificGifts === "Yes" && (
              <div className="mt-5">
                <QuestionLabel>Describe your specific gifts</QuestionLabel>
                <textarea value={intake.specificGiftsDescription} onChange={(e) => update({ specificGiftsDescription: e.target.value })} placeholder="Example: My 1967 Ford Mustang to my son James Smith" rows={4} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors resize-none" />
                <p className="mt-2 text-xs text-charcoal/60">Specific gifts are distributed before the rest of your estate.</p>
              </div>
            )}
          </>
        );

      case "review":
        return (
          <div className="space-y-4 text-sm">
            <div><p className="font-medium text-navy">Personal Information</p><p className="text-charcoal/70">{intake.firstName} {intake.lastName} &middot; {intake.dateOfBirth} &middot; {intake.city}, Michigan</p></div>
            <hr className="border-gray-100" />
            <div><p className="font-medium text-navy">Trust Details</p>
              <p className="text-charcoal/70">Name: {intake.trustName || `The ${intake.firstName} ${intake.lastName} Revocable Living Trust`}</p>
              <p className="text-charcoal/70">Trustee: {intake.primaryTrustee === "Myself" ? "Yourself" : intake.trusteeName}</p>
              <p className="text-charcoal/70">Successor: {intake.successorTrusteeName} ({intake.successorTrusteeRelationship})</p>
              {intake.secondSuccessorTrusteeName && <p className="text-charcoal/50 text-xs">2nd backup: {intake.secondSuccessorTrusteeName}</p>}
            </div>
            <hr className="border-gray-100" />
            <div><p className="font-medium text-navy">Beneficiaries</p>
              <p className="text-charcoal/70">{intake.primaryBeneficiaryName} ({intake.primaryBeneficiaryRelationship})</p>
              {intake.hasSecondBeneficiary === "Yes" && <p className="text-charcoal/70">{intake.secondBeneficiaryName} ({intake.secondBeneficiaryRelationship}) &middot; Split: {intake.estateSplit === "50/50" ? "50/50 (equal)" : intake.customSplit || intake.estateSplit}</p>}
              {hasMinorChildren && intake.distributionAge && <p className="text-charcoal/50 text-xs">Distribution age: {intake.distributionAge}</p>}
              {intake.hasContingentBeneficiary === "Yes" && intake.contingentBeneficiaries.length > 0 ? (
                <p className="text-charcoal/50 text-xs mt-1">Contingent: {intake.contingentBeneficiaries.map((b) => `${b.name} (${b.relationship})`).join(", ")}</p>
              ) : (
                <p className="text-charcoal/50 text-xs mt-1">No contingent beneficiary designated</p>
              )}
            </div>
            <hr className="border-gray-100" />
            <div><p className="font-medium text-navy">Pour-Over Will</p><p className="text-charcoal/70">Executor: {intake.executorName} ({intake.executorRelationship})</p><p className="text-charcoal/50 text-xs">Backup: {intake.successorExecutorName}</p></div>
            <hr className="border-gray-100" />
            <div><p className="font-medium text-navy">Power of Attorney</p><p className="text-charcoal/70">Agent: {intake.poaAgentName} ({intake.poaAgentRelationship})</p><p className="text-charcoal/50 text-xs">Backup: {intake.poaSuccessorAgentName}</p><p className="text-charcoal/50 text-xs">Powers: {intake.poaPowers.join(", ")}</p></div>
            <hr className="border-gray-100" />
            <div><p className="font-medium text-navy">Healthcare Directive</p><p className="text-charcoal/70">Advocate: {intake.patientAdvocateName} ({intake.patientAdvocateRelationship})</p><p className="text-charcoal/50 text-xs">Backup: {intake.successorPatientAdvocateName}</p>
              <p className="text-charcoal/50 text-xs">Organ donation: {intake.organDonation || "Not specified"}</p>
              {intake.hasHealthcareWishes === "Yes" && <p className="text-charcoal/50 text-xs mt-1">Wishes: {intake.healthcareWishesDescription}</p>}
            </div>
            {hasMinorChildren && intake.guardianName && (<><hr className="border-gray-100" /><div><p className="font-medium text-navy">Guardian</p><p className="text-charcoal/70">{intake.guardianName} ({intake.guardianRelationship})</p><p className="text-charcoal/50 text-xs">Backup: {intake.successorGuardianName}</p></div></>)}
            <hr className="border-gray-100" />
            <div><p className="font-medium text-navy">Assets in Trust</p><p className="text-charcoal/70">{intake.assetTypes.join(", ")}</p></div>
            {intake.hasSpecificGifts === "Yes" && (<><hr className="border-gray-100" /><div><p className="font-medium text-navy">Specific Gifts</p><p className="text-charcoal/70 whitespace-pre-wrap">{intake.specificGiftsDescription}</p></div></>)}
          </div>
        );

      default: return null;
    }
  }

  return (
    <div className="min-h-screen bg-navy">
      <div className="fixed top-0 left-0 right-0 z-40 h-1.5 bg-navy/80"><div className="h-full bg-gold transition-all duration-500 ease-out" style={{ width: `${progress}%` }} /></div>
      <div className="fixed top-1.5 left-0 right-0 z-30 flex items-center justify-between px-6 py-3">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"><span className="text-lg">&larr;</span> Back</button>
        <span className="text-xs text-white/60">{safeIndex + 1} of {totalCards}</span>
      </div>
      <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-8">
        <div className={`w-full max-w-lg transform transition-all duration-300 ease-out ${slideClass}`}>
          <div className="rounded-2xl bg-white p-6 md:p-8 shadow-xl">
            <p className="mb-6 text-xs font-medium uppercase tracking-wider text-gold">{moduleTitles[activeCardId]}</p>
            {activeCardId === "review" && <h2 className="mb-4 text-lg font-bold text-navy">Does everything look right?</h2>}
            {renderCard()}
            {activeCardId === "review" ? (
              <div className="mt-8 flex gap-3">
                <button onClick={() => setCurrentCard(0)} className="flex-1 min-h-[44px] rounded-full border-2 border-gray-200 py-3 text-sm font-medium text-navy hover:border-navy transition-colors">Edit Answers</button>
                <button onClick={handleContinue} className="flex-1 min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors shadow-md">Looks Good — Continue</button>
              </div>
            ) : (
              <button onClick={handleContinue} disabled={!isCardComplete()} className={`mt-8 flex w-full min-h-[44px] items-center justify-center rounded-full py-3.5 text-sm font-semibold transition-all ${isCardComplete() ? "bg-gold text-white hover:bg-gold/90 shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>Continue &rarr;</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
