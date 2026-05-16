"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type TrustIntake, initialTrustIntake, checkComplexity } from "@/lib/trust-types";
import AcknowledgmentCard from "@/components/intake/AcknowledgmentCard";
import PartnerThemedShell, { BrandedLoadingWordmark } from "@/components/partner/PartnerThemedShell";
import ChoiceTile from "@/components/quiz/ChoiceTile";
import YesNoTiles from "@/components/quiz/YesNoTiles";
import TextInput from "@/components/quiz/TextInput";
import NameInput from "@/components/quiz/NameInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";

type Stage = "acknowledgment" | "intake" | "redirecting";

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
const maritalOptions = ["Single", "Married", "Domestic partnership", "Divorced", "Widowed"];
const benRelOptions = ["Spouse/Partner", "Child", "Parent", "Sibling", "Other"];
const execRelOptions = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Other"];

export default function TrustPage() {
  const router = useRouter();
  const [partnerParam, setPartnerParam] = useState("");
  const [stage, setStage] = useState<Stage>("acknowledgment");
  const [userId, setUserId] = useState<string | null>(null);
  const [intake, setIntake] = useState<TrustIntake>(initialTrustIntake);
  const [currentCard, setCurrentCard] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [customAgeMode, setCustomAgeMode] = useState(false);
  const [customAgeError, setCustomAgeError] = useState("");
  const hasMinorChildren = intake.hasMinorChildren === "Yes";
  const [openReviewSections, setOpenReviewSections] = useState<Record<string, boolean>>({
    residency: false,
    personal: false,
    trust: false,
    beneficiaries: false,
    guardian: false,
    assets: false,
    pourover: false,
    poa: false,
    healthcare: false,
    gifts: false,
  });
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  })();

  const partialNamesRef = useRef<Set<string>>(new Set());
  const [hasPartialName, setHasPartialName] = useState(false);
  const partialHandlersRef = useRef<Map<string, (p: boolean) => void>>(new Map());
  function partialHandler(key: string) {
    let h = partialHandlersRef.current.get(key);
    if (!h) {
      h = (partial: boolean) => {
        const set = partialNamesRef.current;
        const prev = set.size;
        if (partial) set.add(key); else set.delete(key);
        if ((prev > 0) !== (set.size > 0)) setHasPartialName(set.size > 0);
      };
      partialHandlersRef.current.set(key, h);
    }
    return h;
  }

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
                update({ guardianName: a.childGuardian, hasMinorChildren: "Yes" });
              }
              if (a.hasChildren === "Yes") update({ hasMinorChildren: "Yes" });
            }
          }
        } catch { /* no quiz data */ }
      }
    }
    init();
  }, [update]);

  // Card IDs
  type CardId = "residency" | "about" | "trustee" | "beneficiaries" | "guardian" | "assets" | "pourover" | "poa" | "healthcare" | "gifts" | "review";

  const visibleCards: CardId[] = ["residency", "about", "trustee", "beneficiaries"];
  if (hasMinorChildren) visibleCards.push("guardian");
  visibleCards.push("assets", "pourover", "poa", "healthcare", "gifts", "review");

  const totalCards = visibleCards.length;
  const safeIndex = Math.min(currentCard, totalCards - 1);
  const activeCardId = visibleCards[safeIndex];
  const progress = ((safeIndex + 1) / totalCards) * 100;

  function isCardComplete(): boolean {
    switch (activeCardId) {
      case "residency":
        return intake.state === "Michigan" && intake.maritalStatus !== "";
      case "about":
        return intake.firstName.trim() !== "" && intake.lastName.trim() !== "" && intake.dateOfBirth !== "" && intake.dateOfBirth <= maxDob && intake.city.trim() !== "" && intake.hasMinorChildren !== "";
      case "trustee":
        return intake.primaryTrustee !== "" && (intake.primaryTrustee === "Myself" || intake.trusteeName.trim() !== "") && intake.successorTrusteeName.trim() !== "" && intake.successorTrusteeRelationship !== "";
      case "beneficiaries": {
        if (intake.beneficiaries.length === 0) return false;
        if (intake.beneficiaries.some((b) => !b.name.trim() || !b.relationship)) return false;
        if (intake.hasContingentBeneficiary === "") return false;
        if (intake.beneficiaries.length > 1) {
          if (!intake.beneficiariesEqualShares) return false;
          if (intake.beneficiariesEqualShares === "No") {
            if (intake.beneficiaries.some((b) => !b.share?.trim())) return false;
            const t = intake.beneficiaries.reduce((s, b) => s + (parseFloat(b.share) || 0), 0);
            if (Math.round(t) !== 100) return false;
          }
        }
        if (intake.hasContingentBeneficiary === "Yes" && (intake.contingentBeneficiaries.length === 0 || intake.contingentBeneficiaries.some((b) => !b.name.trim() || !b.relationship))) return false;
        if (intake.hasContingentBeneficiary === "Yes" && intake.contingentBeneficiaries.length > 1) {
          if (!intake.contingentEqualShares) return false;
          if (intake.contingentEqualShares === "No") {
            if (intake.contingentBeneficiaries.some((b) => !b.share?.trim())) return false;
            const shareTotal = intake.contingentBeneficiaries.reduce((sum, b) => sum + (parseFloat(b.share) || 0), 0);
            if (Math.round(shareTotal) !== 100) return false;
          }
        }
        if (hasMinorChildren && !intake.distributionAge) return false;
        return true;
      }
      case "guardian":
        return intake.guardianName.trim() !== "" && intake.guardianRelationship !== "";
      case "assets":
        return intake.assetTypes.length > 0;
      case "pourover":
        return intake.executorName.trim() !== "" && intake.executorRelationship !== "";
      case "poa":
        return intake.poaAgentName.trim() !== "" && intake.poaAgentRelationship !== "" && intake.poaPowers.length > 0;
      case "healthcare":
        return intake.patientAdvocateName.trim() !== "" && intake.patientAdvocateRelationship !== "" && intake.organDonation !== "" && intake.hasHealthcareWishes !== "" && (intake.hasHealthcareWishes === "No" || intake.healthcareWishesDescription.trim() !== "");
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
    if (!isCardComplete() || hasPartialName) return;
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

  if (stage === "redirecting") {
    return (
      <PartnerThemedShell showHeader={false}>
        <div className="min-h-screen bg-navy flex items-center justify-center">
          <BrandedLoadingWordmark />
        </div>
      </PartnerThemedShell>
    );
  }

  if (stage === "acknowledgment") {
    return (
      <PartnerThemedShell showHeader={false}>
        <AcknowledgmentCard onContinue={() => setStage("intake")} />
      </PartnerThemedShell>
    );
  }

  const moduleTitles: Record<CardId, string> = {
    residency: "Residency & Status",
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
      setIntake((prev) => ({
        ...prev,
        poaPowers: prev.poaPowers.length === ALL_POA_POWERS.length ? ["Banking and finances"] : [...ALL_POA_POWERS],
      }));
      return;
    }
    setIntake((prev) => ({
      ...prev,
      poaPowers: prev.poaPowers.includes(power) ? prev.poaPowers.filter((p) => p !== power) : [...prev.poaPowers, power],
    }));
  }

  function renderCard() {
    switch (activeCardId) {
      case "residency":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60 leading-relaxed">
              We&apos;ll start with a couple of quick questions so we can confirm we can serve you.
            </p>
            <QuestionLabel required>What state do you live in?</QuestionLabel>
            <div className="grid grid-cols-2 gap-3">
              {["Michigan", "Other"].map((opt) => (
                <ChoiceTile
                  key={opt}
                  label={opt}
                  selected={intake.state === opt}
                  onClick={() => update({ state: opt })}
                />
              ))}
            </div>
            {intake.state === "Other" && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                We&apos;re currently only providing services for Michigan residents. We&apos;re working to expand soon, please check back later.
              </div>
            )}
            <div className="mt-5">
              <QuestionLabel required>What is your marital status?</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">
                {maritalOptions.map((opt) => (
                  <ChoiceTile
                    key={opt}
                    label={opt}
                    selected={intake.maritalStatus === opt}
                    onClick={() => update({ maritalStatus: opt })}
                  />
                ))}
              </div>
            </div>
          </>
        );

      case "about":
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <QuestionLabel required>First name</QuestionLabel>
                <TextInput value={intake.firstName} onChange={(v) => update({ firstName: v })} placeholder="First name" />
              </div>
              <div>
                <QuestionLabel required>Last name</QuestionLabel>
                <TextInput value={intake.lastName} onChange={(v) => update({ lastName: v })} placeholder="Last name" />
              </div>
            </div>
            <div className="mt-5">
              <QuestionLabel required>Date of birth</QuestionLabel>
              <input
                type="date"
                required
                aria-required="true"
                value={intake.dateOfBirth}
                max={maxDob}
                onChange={(e) => update({ dateOfBirth: e.target.value })}
                onClick={(e) => {
                  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                  el.showPicker?.();
                }}
                className="min-h-[44px] w-full cursor-pointer rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
              />
              {intake.dateOfBirth && intake.dateOfBirth > maxDob && (
                <p className="mt-1.5 text-xs text-red-500">You must be at least 18 years old.</p>
              )}
            </div>
            <div className="mt-5"><QuestionLabel required>City of residence</QuestionLabel><TextInput value={intake.city} onChange={(v) => update({ city: v })} placeholder="e.g. Grand Rapids" /></div>
            <div className="mt-5"><QuestionLabel required>Do you have minor children (under 18)?</QuestionLabel><YesNoTiles value={intake.hasMinorChildren} onChange={(v) => update({ hasMinorChildren: v, ...(v === "No" ? { guardianName: "", guardianRelationship: "", successorGuardianName: "" } : {}) })} /></div>
            <div className="mt-5">
              <QuestionLabel>Trust name (optional)</QuestionLabel>
              <p className="mb-2 text-xs text-charcoal/50">Leave blank to use the default: &quot;The [Your Name] Revocable Living Trust&quot;</p>
              <TextInput value={intake.trustName} onChange={(v) => update({ trustName: v })} placeholder={`e.g. The ${[intake.firstName, intake.lastName].filter(Boolean).join(" ") || "John Smith"} Revocable Living Trust`} />
            </div>
          </>
        );

      case "trustee":
        return (
          <>
            <p className="mb-2 text-xs text-charcoal/60 leading-relaxed">Your trustee is responsible for managing the assets inside your trust. While you are alive and capable, you remain in full control as your own trustee.</p>
            <p className="mb-5 text-xs text-charcoal/50">Most people name <strong>Myself</strong> as the primary trustee. Your successor trustee automatically takes over only if you become incapacitated or pass away, they have no control during your lifetime.</p>
            <QuestionLabel>Who are you creating trust for?</QuestionLabel>
            <div className="grid grid-cols-2 gap-3">
              {["Myself", "Someone else"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.primaryTrustee === opt} onClick={() => update({ primaryTrustee: opt, ...(opt === "Myself" ? { trusteeName: "" } : {}) })} />))}
            </div>
            {intake.primaryTrustee === "Someone else" && (
              <div className="mt-5">
                <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                  <strong>Note:</strong> Naming someone other than yourself as primary trustee means they will manage trust assets immediately. Most people name themselves and rely on the successor trustee for continuity. Consider carefully before selecting this option.
                </div>
                <QuestionLabel required>Trustee name</QuestionLabel>
                <NameInput value={intake.trusteeName} onChange={(v) => update({ trusteeName: v })} />
              </div>
            )}
            <div className="mt-5"><QuestionLabel required>Successor trustee name</QuestionLabel><p className="mb-2 text-xs text-charcoal/50">Who takes over if you are unable to serve?</p><NameInput value={intake.successorTrusteeName} onChange={(v) => update({ successorTrusteeName: v })} /></div>
            <div className="mt-5"><QuestionLabel>Successor trustee relationship</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">{relOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.successorTrusteeRelationship === opt} onClick={() => update({ successorTrusteeRelationship: opt })} />))}</div>
            </div>
            {intake.additionalSuccessorTrustees.map((st, idx) => (
              <div key={idx} className="mt-5 rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <QuestionLabel>{idx === 0 ? "Second" : idx === 1 ? "Third" : `Backup ${idx + 2}`} successor trustee name</QuestionLabel>
                  <button
                    type="button"
                    onClick={() => {
                      const u = intake.additionalSuccessorTrustees.filter((_, i) => i !== idx);
                      update({ additionalSuccessorTrustees: u });
                    }}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                </div>
                {idx === 0 && <p className="mb-2 text-xs text-charcoal/50">Optional backup, highly recommended</p>}
                <NameInput
                  value={st.name}
                  onChange={(v) => {
                    const u = [...intake.additionalSuccessorTrustees];
                    u[idx] = { ...u[idx], name: v };
                    update({ additionalSuccessorTrustees: u });
                  }}
                  optional
                  onPartialChange={partialHandler(`add-trustee-${idx}`)}
                />
                <div className="mt-3">
                  <QuestionLabel>Relationship</QuestionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {relOptions.map((opt) => (
                      <ChoiceTile
                        key={opt}
                        label={opt}
                        selected={st.relationship === opt}
                        onClick={() => {
                          const u = [...intake.additionalSuccessorTrustees];
                          u[idx] = { ...u[idx], relationship: opt };
                          update({ additionalSuccessorTrustees: u });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ additionalSuccessorTrustees: [...intake.additionalSuccessorTrustees, { name: "", relationship: "" }] })}
              className="mt-3 text-sm text-gold font-medium hover:text-gold/80"
            >
              + Add {intake.additionalSuccessorTrustees.length === 0 ? "a backup" : "another"} successor trustee
            </button>
          </>
        );

      case "beneficiaries":
        return (
          <>
            {intake.beneficiaries.map((b, idx) => (
              <div key={idx} className={idx === 0 ? "" : "mt-5 rounded-lg bg-gray-50 p-4"}>
                <div className={idx === 0 ? "" : "mb-2 flex items-center justify-between"}>
                  <QuestionLabel required>{idx === 0 ? "Beneficiary name" : `Beneficiary ${idx + 1} name`}</QuestionLabel>
                  {idx > 0 && (
                    <button type="button" onClick={() => update({ beneficiaries: intake.beneficiaries.filter((_, i) => i !== idx) })} className="text-xs text-red-500 hover:text-red-600 font-medium">Remove</button>
                  )}
                </div>
                <NameInput value={b.name} onChange={(v) => { const u = [...intake.beneficiaries]; u[idx] = { ...u[idx], name: v }; update({ beneficiaries: u }); }} />
                <div className="mt-3"><QuestionLabel required>Relationship</QuestionLabel><div className="grid grid-cols-2 gap-2">{benRelOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={b.relationship === opt} onClick={() => { const u = [...intake.beneficiaries]; u[idx] = { ...u[idx], relationship: opt }; update({ beneficiaries: u }); }} />))}</div></div>
              </div>
            ))}
            <button type="button" onClick={() => update({ beneficiaries: [...intake.beneficiaries, { name: "", relationship: "", share: "" }] })} className="mt-3 text-sm text-gold font-medium hover:text-gold/80">+ Add another beneficiary</button>
            {intake.beneficiaries.length > 1 && (
              <div className="mt-5">
                <QuestionLabel required>Should beneficiaries receive equal shares?</QuestionLabel>
                <YesNoTiles value={intake.beneficiariesEqualShares} onChange={(v) => update({ beneficiariesEqualShares: v, beneficiaries: intake.beneficiaries.map((b) => ({ ...b, share: "" })) })} />
                {intake.beneficiariesEqualShares === "No" && (() => {
                  const total = intake.beneficiaries.reduce((s, b) => s + (parseFloat(b.share) || 0), 0);
                  return (
                    <div className="mt-3 space-y-2">
                      {intake.beneficiaries.map((b, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3">
                          <span className="flex-1 truncate text-sm font-medium text-navy">{b.name || `Beneficiary ${idx + 1}`}</span>
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} max={100} value={b.share} onChange={(e) => { const u = [...intake.beneficiaries]; u[idx] = { ...u[idx], share: e.target.value }; update({ beneficiaries: u }); }} className="w-16 rounded-lg border-2 border-gray-200 px-2 py-1.5 text-center text-sm font-medium focus:border-gold focus:outline-none transition-colors" placeholder="0" />
                            <span className="text-sm text-charcoal/50">%</span>
                          </div>
                        </div>
                      ))}
                      <p className={`text-sm font-medium ${Math.round(total) === 100 ? "text-green-600" : "text-red-500"}`}>Total: {total % 1 === 0 ? total : total.toFixed(1)}%{Math.round(total) === 100 ? ", all set" : ", must equal 100%"}</p>
                    </div>
                  );
                })()}
              </div>
            )}
            {hasMinorChildren && (() => {
              const presetAges = ["18", "21", "25", "30"];
              const isCustomSelected = customAgeMode || (!!intake.distributionAge && !presetAges.includes(intake.distributionAge));
              return (
                <div className="mt-5">
                  <QuestionLabel>At what age should a minor beneficiary receive their full inheritance?</QuestionLabel>
                  <p className="mb-2 text-xs text-charcoal/50">Assets are held in trust until this age. Michigan law grants full rights at 18.</p>
                  <div className="grid grid-cols-5 gap-3">
                    {presetAges.map((opt) => (
                      <ChoiceTile key={opt} label={opt} selected={!isCustomSelected && intake.distributionAge === opt} onClick={() => { setCustomAgeMode(false); update({ distributionAge: opt }); }} />
                    ))}
                    <ChoiceTile label="Other" selected={isCustomSelected} onClick={() => { setCustomAgeMode(true); if (presetAges.includes(intake.distributionAge)) update({ distributionAge: "" }); }} />
                  </div>
                  {isCustomSelected && (
                    <div className="mt-3">
                      <TextInput
                        value={intake.distributionAge}
                        onChange={(v) => {
                          const digits = v.replace(/[^0-9]/g, "");
                          if (digits.length > 0 && parseInt(digits, 10) > 99) {
                            setCustomAgeError("Age must be under 99.");
                            update({ distributionAge: "99" });
                          } else {
                            setCustomAgeError("");
                            update({ distributionAge: digits.slice(0, 2) });
                          }
                        }}
                        placeholder="Enter custom age (e.g., 35)"
                      />
                      {customAgeError && (
                        <p className="mt-1 text-xs text-red-500">{customAgeError}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Contingent beneficiary */}
            <div className="mt-5">
              <QuestionLabel>Add a contingent beneficiary?</QuestionLabel>
              <p className="mb-3 text-xs text-charcoal/50">A contingent beneficiary inherits only if your primary beneficiary cannot. Example: your children inherit if your spouse passes before you.</p>
              <YesNoTiles value={intake.hasContingentBeneficiary} onChange={(v) => { update({ hasContingentBeneficiary: v }); if (v === "Yes" && intake.contingentBeneficiaries.length === 0) update({ contingentBeneficiaries: [{ name: "", relationship: "", share: "" }] }); if (v === "No") update({ contingentBeneficiaries: [], contingentEqualShares: "" }); }} />
            </div>
            {intake.hasContingentBeneficiary === "Yes" && (
              <>
                {intake.contingentBeneficiaries.map((cb, idx) => (
                  <div key={idx} className="mt-5 rounded-lg bg-gray-50 p-4">
                    <QuestionLabel required>{idx === 0 ? "Contingent beneficiary name" : `Contingent beneficiary ${idx + 1} name`}</QuestionLabel>
                    <NameInput value={cb.name} onChange={(v) => { const u = [...intake.contingentBeneficiaries]; u[idx] = { ...u[idx], name: v }; update({ contingentBeneficiaries: u }); }} />
                    <div className="mt-3"><QuestionLabel>Relationship</QuestionLabel>
                      <div className="grid grid-cols-2 gap-2">{["Child", "Parent", "Sibling", "Friend", "Charity/Organization", "Other"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={cb.relationship === opt} onClick={() => { const u = [...intake.contingentBeneficiaries]; u[idx] = { ...u[idx], relationship: opt }; update({ contingentBeneficiaries: u }); }} />))}</div>
                    </div>
                  </div>
                ))}
                {intake.contingentBeneficiaries.length < 3 && (
                  <button type="button" onClick={() => update({ contingentBeneficiaries: [...intake.contingentBeneficiaries, { name: "", relationship: "", share: "" }] })} className="mt-3 text-sm text-gold font-medium hover:text-gold/80">+ Add another contingent beneficiary</button>
                )}
                {intake.contingentBeneficiaries.length > 1 && (
                  <div className="mt-5">
                    <QuestionLabel>Should these beneficiaries receive equal shares?</QuestionLabel>
                    <YesNoTiles value={intake.contingentEqualShares} onChange={(v) => { update({ contingentEqualShares: v, contingentBeneficiaries: intake.contingentBeneficiaries.map((b) => ({ ...b, share: "" })) }); }} />
                    {intake.contingentEqualShares === "No" && (() => {
                      const total = intake.contingentBeneficiaries.reduce((sum, b) => sum + (parseFloat(b.share) || 0), 0);
                      const rounded = Math.round(total);
                      return (
                        <div className="mt-3 space-y-2">
                          {intake.contingentBeneficiaries.map((cb, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3">
                              <span className="flex-1 truncate text-sm font-medium text-navy">{cb.name || `Beneficiary ${idx + 1}`}</span>
                              <div className="flex items-center gap-1.5">
                                <input type="number" min={0} max={100} value={cb.share}
                                  onChange={(e) => { const u = [...intake.contingentBeneficiaries]; u[idx] = { ...u[idx], share: e.target.value }; update({ contingentBeneficiaries: u }); }}
                                  className="w-16 rounded-lg border-2 border-gray-200 px-2 py-1.5 text-center text-sm font-medium focus:border-gold focus:outline-none transition-colors"
                                  placeholder="0" />
                                <span className="text-sm text-charcoal/50">%</span>
                              </div>
                            </div>
                          ))}
                          <p className={`text-sm font-medium ${rounded === 100 ? "text-green-600" : "text-red-500"}`}>
                            Total: {total % 1 === 0 ? total : total.toFixed(1)}%{rounded === 100 ? ", all set" : ", must equal 100%"}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </>
        );

      case "guardian":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">This person would raise your children if something happened to you.</p>
            <QuestionLabel required>Guardian name</QuestionLabel><NameInput value={intake.guardianName} onChange={(v) => update({ guardianName: v })} />
            <div className="mt-5"><QuestionLabel>Guardian relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{["Spouse/Partner", "Sibling", "Parent", "Friend", "Other"].map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.guardianRelationship === opt} onClick={() => update({ guardianRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Successor guardian name</QuestionLabel><NameInput value={intake.successorGuardianName} onChange={(v) => update({ successorGuardianName: v })} optional onPartialChange={partialHandler("successor-guardian")} /></div>
          </>
        );

      case "assets":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">You don&apos;t need exact values, this helps us prepare the right provisions.</p>
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
            <QuestionLabel required>Who should carry out your Pour-Over Will?</QuestionLabel><NameInput value={intake.executorName} onChange={(v) => update({ executorName: v })} />
            <div className="mt-5"><QuestionLabel>Executor relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{execRelOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.executorRelationship === opt} onClick={() => update({ executorRelationship: opt })} />))}</div></div>
            <div className="mt-5">
              <QuestionLabel>Successor executor</QuestionLabel>
              <NameInput
                value={intake.successorExecutorName}
                onChange={(v) => {
                  update({ successorExecutorName: v });
                  if (!v) update({ successorExecutorRelationship: "" });
                }}
                optional
                onPartialChange={partialHandler("successor-executor")}
              />
              {intake.successorExecutorName.trim() !== "" && (
                <div className="mt-3">
                  <QuestionLabel>Successor executor relationship</QuestionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {execRelOptions.map((opt) => (
                      <ChoiceTile
                        key={opt}
                        label={opt}
                        selected={intake.successorExecutorRelationship === opt}
                        onClick={() => update({ successorExecutorRelationship: opt })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        );

      case "poa":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">This person manages your finances if you become incapacitated.</p>
            <QuestionLabel required>Agent name</QuestionLabel><NameInput value={intake.poaAgentName} onChange={(v) => update({ poaAgentName: v })} />
            <div className="mt-5"><QuestionLabel>Agent relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{relOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.poaAgentRelationship === opt} onClick={() => update({ poaAgentRelationship: opt })} />))}</div></div>
            <div className="mt-5">
              <QuestionLabel>Successor agent name</QuestionLabel>
              <NameInput
                value={intake.poaSuccessorAgentName}
                onChange={(v) => {
                  update({ poaSuccessorAgentName: v });
                  if (!v) update({ poaSuccessorAgentRelationship: "" });
                }}
                optional
                onPartialChange={partialHandler("poa-successor")}
              />
              {intake.poaSuccessorAgentName.trim() !== "" && (
                <div className="mt-3">
                  <QuestionLabel>Successor agent relationship</QuestionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {relOptions.map((opt) => (
                      <ChoiceTile
                        key={opt}
                        label={opt}
                        selected={intake.poaSuccessorAgentRelationship === opt}
                        onClick={() => update({ poaSuccessorAgentRelationship: opt })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            <QuestionLabel required>Patient advocate name</QuestionLabel><NameInput value={intake.patientAdvocateName} onChange={(v) => update({ patientAdvocateName: v })} />
            <div className="mt-5"><QuestionLabel>Relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{relOptions.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.patientAdvocateRelationship === opt} onClick={() => update({ patientAdvocateRelationship: opt })} />))}</div></div>
            <div className="mt-5"><QuestionLabel>Successor patient advocate</QuestionLabel><NameInput value={intake.successorPatientAdvocateName} onChange={(v) => update({ successorPatientAdvocateName: v })} optional onPartialChange={partialHandler("successor-advocate")} /></div>
            <div className="mt-5"><QuestionLabel>Do you wish to be an organ and tissue donor?</QuestionLabel><YesNoTiles value={intake.organDonation} onChange={(v) => update({ organDonation: v })} /></div>
            <div className="mt-5"><QuestionLabel>Do you have specific healthcare wishes to document?</QuestionLabel><YesNoTiles value={intake.hasHealthcareWishes} onChange={(v) => update({ hasHealthcareWishes: v, ...(v === "No" ? { healthcareWishesDescription: "" } : {}) })} /></div>
            {intake.hasHealthcareWishes === "Yes" && (
              <div className="mt-5">
                <textarea value={intake.healthcareWishesDescription} onChange={(e) => update({ healthcareWishesDescription: e.target.value })} placeholder="Example: I do not wish to be kept on life support if there is no reasonable chance of recovery." rows={4} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors resize-none" />
                <p className="mt-2 text-xs text-charcoal/60">This is your personal instruction, it guides your advocate&apos;s decisions.</p>
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

      case "review": {
        const jumpToCard = (cardId: CardId) => {
          const idx = visibleCards.indexOf(cardId);
          if (idx >= 0) animateTransition("back", () => setCurrentCard(idx));
        };
        const toggleSec = (k: string) =>
          setOpenReviewSections((s) => ({ ...s, [k]: !s[k] }));
        const Row = ({ label, value }: { label: string; value: ReactNode }) => (
          <div className="flex justify-between gap-3 py-1.5 border-b border-gray-100 last:border-b-0">
            <span className="text-xs text-charcoal/60">{label}</span>
            <span className="text-sm text-charcoal text-right break-words">{value || <span className="text-charcoal/40 italic">Not provided</span>}</span>
          </div>
        );
        const Section = ({
          k, title, target, children,
        }: { k: string; title: string; target: CardId; children: ReactNode }) => {
          const open = openReviewSections[k];
          return (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <button type="button" onClick={() => toggleSec(k)} className="flex-1 flex items-center gap-2 text-left">
                  <span className={`text-charcoal/60 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                  <span className="font-semibold text-navy text-sm">{title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => jumpToCard(target)}
                  className="text-xs font-medium text-gold hover:text-gold/80 px-2 py-1 rounded"
                >
                  Edit
                </button>
              </div>
              {open && <div className="px-4 py-3 space-y-0.5">{children}</div>}
            </div>
          );
        };
        const primaryShares =
          intake.beneficiaries.length > 1
            ? intake.beneficiariesEqualShares === "No"
              ? "Custom split"
              : "Equal shares"
            : "Sole beneficiary";
        const contingentSummary =
          intake.hasContingentBeneficiary === "Yes" && intake.contingentBeneficiaries.length > 0
            ? intake.contingentBeneficiaries
                .map((b) =>
                  intake.contingentEqualShares === "No" && b.share
                    ? `${b.name} (${b.relationship}) — ${b.share}%`
                    : `${b.name} (${b.relationship})`
                )
                .join(", ")
            : "None designated";
        const allOpen = Object.values(openReviewSections).every(Boolean);
        const setAll = (val: boolean) =>
          setOpenReviewSections((s) => Object.fromEntries(Object.keys(s).map((k) => [k, val])) as Record<string, boolean>);
        return (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-charcoal/60">Tap any section to expand. Use Edit to change answers.</p>
              <button
                type="button"
                onClick={() => setAll(!allOpen)}
                className="text-xs font-medium text-gold hover:text-gold/80"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
            <Section k="residency" title="Residency & Status" target="residency">
              <Row label="State" value={intake.state} />
              <Row label="Marital status" value={intake.maritalStatus} />
            </Section>

            <Section k="personal" title="Personal Information" target="about">
              <Row label="Name" value={`${intake.firstName} ${intake.lastName}`.trim()} />
              <Row label="Date of birth" value={intake.dateOfBirth} />
              <Row label="City" value={intake.city} />
              <Row label="Minor children" value={intake.hasMinorChildren} />
            </Section>

            <Section k="trust" title="Trust & Trustees" target="trustee">
              <Row label="Trust name" value={intake.trustName || `The ${intake.firstName} ${intake.lastName} Revocable Living Trust`.trim()} />
              <Row label="Primary trustee" value={intake.primaryTrustee === "Myself" ? "Yourself" : intake.trusteeName} />
              <Row label="Successor trustee" value={intake.successorTrusteeName} />
              <Row label="Relationship" value={intake.successorTrusteeRelationship} />
              {intake.additionalSuccessorTrustees.filter((s) => s.name.trim()).map((s, i) => (
                <Row key={i} label={`${i === 0 ? "2nd" : i === 1 ? "3rd" : `${i + 2}th`} backup`} value={`${s.name}${s.relationship ? ` (${s.relationship})` : ""}`} />
              ))}
            </Section>

            <Section k="beneficiaries" title="Beneficiaries" target="beneficiaries">
              <Row label="Distribution" value={primaryShares} />
              <div className="pt-1">
                {intake.beneficiaries.map((b, i) => (
                  <div key={i} className="py-1 border-b border-gray-100 last:border-b-0">
                    <p className="text-sm text-charcoal">{b.name || <span className="text-charcoal/40 italic">No name</span>}</p>
                    <p className="text-xs text-charcoal/60">
                      {b.relationship}
                      {intake.beneficiaries.length > 1 && intake.beneficiariesEqualShares === "No" && b.share
                        ? ` · ${b.share}%`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
              {hasMinorChildren && intake.distributionAge && (
                <Row label="Distribution age" value={intake.distributionAge} />
              )}
              <Row label="Contingent" value={contingentSummary} />
            </Section>

            {hasMinorChildren && (
              <Section k="guardian" title="Guardian" target="guardian">
                <Row label="Guardian name" value={intake.guardianName} />
                <Row label="Relationship" value={intake.guardianRelationship} />
                <Row label="Successor guardian" value={intake.successorGuardianName} />
              </Section>
            )}

            <Section k="assets" title="Assets in Trust" target="assets">
              {intake.assetTypes.length === 0 ? (
                <Row label="Assets" value="" />
              ) : (
                intake.assetTypes.map((a) => (
                  <Row key={a} label="" value={a} />
                ))
              )}
            </Section>

            <Section k="pourover" title="Pour-Over Will" target="pourover">
              <Row label="Executor" value={intake.executorName} />
              <Row label="Relationship" value={intake.executorRelationship} />
              <Row label="Successor executor" value={intake.successorExecutorName} />
              <Row label="Successor relationship" value={intake.successorExecutorRelationship} />
            </Section>

            <Section k="poa" title="Power of Attorney" target="poa">
              <Row label="Agent" value={intake.poaAgentName} />
              <Row label="Relationship" value={intake.poaAgentRelationship} />
              <Row label="Successor agent" value={intake.poaSuccessorAgentName} />
              <Row label="Successor relationship" value={intake.poaSuccessorAgentRelationship} />
              <Row label="Powers" value={intake.poaPowers.join(", ")} />
            </Section>

            <Section k="healthcare" title="Healthcare Directive" target="healthcare">
              <Row label="Advocate" value={intake.patientAdvocateName} />
              <Row label="Relationship" value={intake.patientAdvocateRelationship} />
              <Row label="Successor advocate" value={intake.successorPatientAdvocateName} />
              <Row label="Organ donation" value={intake.organDonation} />
              <Row label="Healthcare wishes" value={intake.hasHealthcareWishes} />
              {intake.hasHealthcareWishes === "Yes" && (
                <Row label="Wishes" value={<span className="whitespace-pre-wrap">{intake.healthcareWishesDescription}</span>} />
              )}
            </Section>

            <Section k="gifts" title="Specific Gifts" target="gifts">
              <Row label="Has gifts" value={intake.hasSpecificGifts} />
              {intake.hasSpecificGifts === "Yes" && (
                <Row label="Description" value={<span className="whitespace-pre-wrap">{intake.specificGiftsDescription}</span>} />
              )}
            </Section>
            </div>
          </div>
        );
      }

      default: return null;
    }
  }

  return (
    <PartnerThemedShell showHeader={false}>
    <div className="min-h-screen bg-navy">
      <div className="fixed top-0 left-0 right-0 z-40 h-1.5 bg-navy/80"><div className="h-full bg-gold transition-all duration-500 ease-out" style={{ width: `${progress}%` }} /></div>
      <div className="fixed top-1.5 left-0 right-0 z-30 flex items-center justify-between px-6 py-3">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"><span className="text-lg">&larr;</span> Back</button>
        <span className="text-xs text-white/60">{safeIndex + 1} of {totalCards}</span>
      </div>
      <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-8">
        <div className={`w-full transform transition-all duration-300 ease-out ${activeCardId === "review" ? "max-w-3xl" : "max-w-lg"} ${slideClass}`}>
          <div className="rounded-2xl bg-white p-6 md:p-8 shadow-xl">
            <p className="mb-6 text-xs font-medium uppercase tracking-wider text-gold">{moduleTitles[activeCardId]}</p>
            {activeCardId === "review" && <h2 className="mb-4 text-lg font-bold text-navy">Does everything look right?</h2>}
            {renderCard()}
            {activeCardId === "review" ? (
              <div className="mt-8 flex gap-3">
                <button onClick={() => setCurrentCard(0)} className="flex-1 min-h-[44px] rounded-full border-2 border-gray-200 py-3 text-sm font-medium text-navy hover:border-navy transition-colors">Edit Answers</button>
                <button onClick={handleContinue} className="flex-1 min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors shadow-md">Looks Good, Continue</button>
              </div>
            ) : (
              <button onClick={handleContinue} disabled={!isCardComplete() || hasPartialName} className={`mt-8 flex w-full min-h-[44px] items-center justify-center rounded-full py-3.5 text-sm font-semibold transition-all ${isCardComplete() && !hasPartialName ? "bg-gold text-white hover:bg-gold/90 shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>Continue &rarr;</button>
            )}
          </div>
        </div>
      </div>
    </div>
    </PartnerThemedShell>
  );
}
