"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type WillIntake, initialWillIntake } from "@/lib/will-types";
import PartnerThemedShell, { BrandedLoadingWordmark } from "@/components/partner/PartnerThemedShell";
import AcknowledgmentCard from "@/components/intake/AcknowledgmentCard";
import ChoiceTile from "@/components/quiz/ChoiceTile";
import YesNoTiles from "@/components/quiz/YesNoTiles";
import TextInput from "@/components/quiz/TextInput";
import NameInput from "@/components/quiz/NameInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";

type Stage = "acknowledgment" | "intake" | "redirecting";

export default function WillPage() {
  const router = useRouter();
  const [partnerParam, setPartnerParam] = useState("");
  const [stage, setStage] = useState<Stage>("acknowledgment");
  const [userId, setUserId] = useState<string | null>(null);

  // Intake
  const [intake, setIntake] = useState<WillIntake>(initialWillIntake);
  const [currentCard, setCurrentCard] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const hasMinorChildren = intake.hasMinorChildren === "Yes";
  const [openReviewSections, setOpenReviewSections] = useState<Record<string, boolean>>({
    residency: false,
    personal: false,
    executor: false,
    beneficiaries: false,
    guardian: false,
    gifts: false,
  });
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  })();

  const update = useCallback(
    (updates: Partial<WillIntake>) =>
      setIntake((prev) => ({ ...prev, ...updates })),
    []
  );

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

  useEffect(() => {
    async function init() {
      setPartnerParam(new URLSearchParams(window.location.search).get("partner") || "");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Try to pre-populate from quiz session
        try {
          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .eq("profile_id", user.id)
            .single();
          if (client) {
            const { data: quiz } = await supabase
              .from("quiz_sessions")
              .select("answers")
              .eq("client_id", client.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            if (quiz?.answers) {
              const a = quiz.answers as Record<string, string>;
              if (a.financeManager) update({ executorName: a.financeManager });
              if (a.childGuardian && a.childGuardian !== "N/A") {
                update({ guardianName: a.childGuardian, hasMinorChildren: "Yes" });
              }
            }
          }
        } catch {}
      }
    }
    init();
  }, [update]);

  // ── Intake card logic ─────────────────────────────────────────
  type CardId = "residency" | "about" | "executor" | "beneficiaries" | "guardian" | "gifts" | "review";

  const visibleCards: CardId[] = ["residency", "about", "executor", "beneficiaries"];
  if (hasMinorChildren) visibleCards.push("guardian");
  visibleCards.push("gifts", "review");

  const totalCards = visibleCards.length;
  const safeIndex = Math.min(currentCard, totalCards - 1);
  const activeCardId = visibleCards[safeIndex];
  const progress = ((safeIndex + 1) / totalCards) * 100;

  function isCardComplete(): boolean {
    switch (activeCardId) {
      case "residency":
        return intake.state === "Michigan" && intake.maritalStatus !== "";
      case "about":
        return (
          intake.firstName.trim() !== "" &&
          intake.lastName.trim() !== "" &&
          intake.dateOfBirth !== "" &&
          intake.dateOfBirth <= maxDob &&
          intake.city.trim() !== "" &&
          intake.hasMinorChildren !== ""
        );
      case "executor":
        return (
          intake.executorName.trim() !== "" &&
          intake.executorRelationship !== ""
        );
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
        if (intake.hasContingentBeneficiary === "Yes" && intake.contingentBeneficiaries.length === 0)
          return false;
        if (intake.hasContingentBeneficiary === "Yes") {
          if (intake.contingentBeneficiaries.some((b) => !b.name.trim() || !b.relationship))
            return false;
          if (intake.contingentBeneficiaries.length > 1) {
            if (!intake.contingentEqualShares) return false;
            if (intake.contingentEqualShares === "No") {
              if (intake.contingentBeneficiaries.some((b) => !b.share?.trim())) return false;
              const shareTotal = intake.contingentBeneficiaries.reduce((sum, b) => sum + (parseFloat(b.share) || 0), 0);
              if (Math.round(shareTotal) !== 100) return false;
            }
          }
        }
        return true;
      }
      case "guardian":
        return (
          intake.guardianName.trim() !== "" &&
          intake.guardianRelationship !== ""
        );
      case "gifts":
        return (
          intake.organDonation !== "" &&
          intake.hasSpecificGifts !== "" &&
          (intake.hasSpecificGifts === "No" ||
            intake.specificGiftsDescription.trim() !== "")
        );
      case "review":
        return true;
      default:
        return false;
    }
  }

  function animateTransition(dir: "forward" | "back", cb: () => void) {
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      cb();
      setAnimating(false);
    }, 300);
  }

  function handleContinue() {
    if (!isCardComplete() || hasPartialName) return;
    if (activeCardId === "review") {
      // Save intake to sessionStorage and go to checkout
      sessionStorage.setItem("willIntake", JSON.stringify(intake));
      sessionStorage.setItem("willUserId", userId || "");
      sessionStorage.setItem("willPartner", partnerParam);
      setStage("redirecting");
      router.push("/will/checkout");
      return;
    }
    animateTransition("forward", () => setCurrentCard((c) => c + 1));
  }

  function handleBack() {
    if (safeIndex <= 0) {
      setStage("acknowledgment");
      return;
    }
    animateTransition("back", () => setCurrentCard((c) => c - 1));
  }

  // Keep card index in bounds
  useEffect(() => {
    if (currentCard >= totalCards) setCurrentCard(totalCards - 1);
  }, [totalCards, currentCard]);

  const slideClass = animating
    ? direction === "forward"
      ? "translate-x-[-100%] opacity-0"
      : "translate-x-[100%] opacity-0"
    : "translate-x-0 opacity-100";

  const relationshipOptions = [
    "Spouse/Partner",
    "Parent",
    "Sibling",
    "Adult Child",
    "Friend",
    "Other",
  ];

  const beneficiaryRelOptions = [
    "Spouse/Partner",
    "Child",
    "Parent",
    "Sibling",
    "Other",
  ];

  const guardianRelOptions = [
    "Spouse/Partner",
    "Sibling",
    "Parent",
    "Friend",
    "Other",
  ];

  // ── REDIRECTING ───────────────────────────────────────────────
  if (stage === "redirecting") {
    return (
      <PartnerThemedShell showHeader={false}>
        <div className="min-h-screen bg-navy flex items-center justify-center">
          <BrandedLoadingWordmark />
        </div>
      </PartnerThemedShell>
    );
  }

  // ── STAGE 1: ACKNOWLEDGMENT ───────────────────────────────────
  if (stage === "acknowledgment") {
    return (
      <PartnerThemedShell showHeader={false}>
        <AcknowledgmentCard onContinue={() => setStage("intake")} />
      </PartnerThemedShell>
    );
  }

  // ── STAGE 2: INTAKE ───────────────────────────────────────────
  const moduleTitles: Record<CardId, string> = {
    residency: "Residency & Status",
    about: "About You",
    executor: "Your Executor",
    beneficiaries: "Your Beneficiaries",
    guardian: "Minor Children",
    gifts: "Specific Gifts",
    review: "Final Review",
  };

  const maritalOptions = ["Single", "Married", "Domestic partnership", "Divorced", "Widowed"];

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
                <TextInput
                  value={intake.firstName}
                  onChange={(v) => update({ firstName: v })}
                  placeholder="First name"
                />
              </div>
              <div>
                <QuestionLabel required>Last name</QuestionLabel>
                <TextInput
                  value={intake.lastName}
                  onChange={(v) => update({ lastName: v })}
                  placeholder="Last name"
                />
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
            <div className="mt-5">
              <QuestionLabel required>City of residence</QuestionLabel>
              <TextInput
                value={intake.city}
                onChange={(v) => update({ city: v })}
                placeholder="e.g. Grand Rapids"
              />
            </div>
            <div className="mt-5">
              <QuestionLabel required>Do you have minor children (under 18)?</QuestionLabel>
              <YesNoTiles
                value={intake.hasMinorChildren}
                onChange={(v) =>
                  update({
                    hasMinorChildren: v,
                    ...(v === "No"
                      ? {
                          guardianName: "",
                          guardianRelationship: "",
                          successorGuardianName: "",
                        }
                      : {}),
                  })
                }
              />
            </div>
          </>
        );

      case "executor":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60 leading-relaxed">
              Your executor is the person who will carry out the instructions in
              your will.
            </p>
            <QuestionLabel required>Executor name</QuestionLabel>
            <NameInput
              value={intake.executorName}
              onChange={(v) => update({ executorName: v })}
            />
            <div className="mt-5">
              <QuestionLabel>Executor relationship to you</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">
                {relationshipOptions.map((opt) => (
                  <ChoiceTile
                    key={opt}
                    label={opt}
                    selected={intake.executorRelationship === opt}
                    onClick={() => update({ executorRelationship: opt })}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <QuestionLabel>Successor executor name</QuestionLabel>
              <p className="mb-2 text-xs text-charcoal/50">
                Backup if your first choice is unable to serve
              </p>
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
                    {relationshipOptions.map((opt) => (
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

      case "beneficiaries":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">
              Who should inherit your estate?
            </p>
            {intake.beneficiaries.map((b, idx) => (
              <div key={idx} className={idx === 0 ? "" : "mt-5 rounded-lg bg-gray-50 p-4"}>
                <div className={idx === 0 ? "" : "mb-2 flex items-center justify-between"}>
                  <QuestionLabel required>{idx === 0 ? "Beneficiary name" : `Beneficiary ${idx + 1} name`}</QuestionLabel>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => update({ beneficiaries: intake.beneficiaries.filter((_, i) => i !== idx) })}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <NameInput
                  value={b.name}
                  onChange={(v) => {
                    const u = [...intake.beneficiaries];
                    u[idx] = { ...u[idx], name: v };
                    update({ beneficiaries: u });
                  }}
                />
                <div className="mt-3">
                  <QuestionLabel required>Relationship</QuestionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {beneficiaryRelOptions.map((opt) => (
                      <ChoiceTile
                        key={opt}
                        label={opt}
                        selected={b.relationship === opt}
                        onClick={() => {
                          const u = [...intake.beneficiaries];
                          u[idx] = { ...u[idx], relationship: opt };
                          update({ beneficiaries: u });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ beneficiaries: [...intake.beneficiaries, { name: "", relationship: "", share: "" }] })}
              className="mt-3 text-sm text-gold font-medium hover:text-gold/80"
            >
              + Add another beneficiary
            </button>
            {intake.beneficiaries.length > 1 && (
              <div className="mt-5">
                <QuestionLabel required>Should beneficiaries receive equal shares?</QuestionLabel>
                <YesNoTiles
                  value={intake.beneficiariesEqualShares}
                  onChange={(v) => {
                    update({
                      beneficiariesEqualShares: v,
                      beneficiaries: intake.beneficiaries.map((b) => ({ ...b, share: "" })),
                    });
                  }}
                />
                {intake.beneficiariesEqualShares === "No" && (() => {
                  const total = intake.beneficiaries.reduce((sum, b) => sum + (parseFloat(b.share) || 0), 0);
                  return (
                    <div className="mt-3 space-y-2">
                      {intake.beneficiaries.map((b, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3">
                          <span className="flex-1 truncate text-sm font-medium text-navy">{b.name || `Beneficiary ${idx + 1}`}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={b.share}
                              onChange={(e) => {
                                const u = [...intake.beneficiaries];
                                u[idx] = { ...u[idx], share: e.target.value };
                                update({ beneficiaries: u });
                              }}
                              className="w-16 rounded-lg border-2 border-gray-200 px-2 py-1.5 text-center text-sm font-medium focus:border-gold focus:outline-none transition-colors"
                              placeholder="0"
                            />
                            <span className="text-sm text-charcoal/50">%</span>
                          </div>
                        </div>
                      ))}
                      <p className={`text-sm font-medium ${Math.round(total) === 100 ? "text-green-600" : "text-red-500"}`}>
                        Total: {total % 1 === 0 ? total : total.toFixed(1)}%{Math.round(total) === 100 ? ", all set" : ", must equal 100%"}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Contingent beneficiary */}
            <div className="mt-5">
              <QuestionLabel>Add a contingent beneficiary?</QuestionLabel>
              <p className="mb-3 text-xs text-charcoal/50">A contingent beneficiary inherits only if your primary beneficiary cannot. Example: your children inherit if your spouse passes before you.</p>
              <YesNoTiles
                value={intake.hasContingentBeneficiary}
                onChange={(v) => {
                  update({ hasContingentBeneficiary: v });
                  if (v === "Yes" && intake.contingentBeneficiaries.length === 0) {
                    update({ contingentBeneficiaries: [{ name: "", relationship: "", share: "" }] });
                  }
                  if (v === "No") update({ contingentBeneficiaries: [], contingentEqualShares: "" });
                }}
              />
            </div>
            {intake.hasContingentBeneficiary === "Yes" && (
              <>
                {intake.contingentBeneficiaries.map((cb, idx) => (
                  <div key={idx} className="mt-5 rounded-lg bg-gray-50 p-4">
                    <QuestionLabel required>{idx === 0 ? "Contingent beneficiary name" : `Contingent beneficiary ${idx + 1} name`}</QuestionLabel>
                    <NameInput
                      value={cb.name}
                      onChange={(v) => {
                        const updated = [...intake.contingentBeneficiaries];
                        updated[idx] = { ...updated[idx], name: v };
                        update({ contingentBeneficiaries: updated });
                      }}
                    />
                    <div className="mt-3">
                      <QuestionLabel>Relationship</QuestionLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {["Child", "Parent", "Sibling", "Friend", "Charity/Organization", "Other"].map((opt) => (
                          <ChoiceTile
                            key={opt}
                            label={opt}
                            selected={cb.relationship === opt}
                            onClick={() => {
                              const updated = [...intake.contingentBeneficiaries];
                              updated[idx] = { ...updated[idx], relationship: opt };
                              update({ contingentBeneficiaries: updated });
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {intake.contingentBeneficiaries.length < 3 && (
                  <button
                    type="button"
                    onClick={() => update({ contingentBeneficiaries: [...intake.contingentBeneficiaries, { name: "", relationship: "", share: "" }] })}
                    className="mt-3 text-sm text-gold font-medium hover:text-gold/80"
                  >
                    + Add another contingent beneficiary
                  </button>
                )}
                {intake.contingentBeneficiaries.length > 1 && (
                  <div className="mt-5">
                    <QuestionLabel>Should these beneficiaries receive equal shares?</QuestionLabel>
                    <YesNoTiles
                      value={intake.contingentEqualShares}
                      onChange={(v) => {
                        update({
                          contingentEqualShares: v,
                          contingentBeneficiaries: intake.contingentBeneficiaries.map((b) => ({ ...b, share: "" })),
                        });
                      }}
                    />
                    {intake.contingentEqualShares === "No" && (() => {
                      const total = intake.contingentBeneficiaries.reduce((sum, b) => sum + (parseFloat(b.share) || 0), 0);
                      const rounded = Math.round(total);
                      return (
                        <div className="mt-3 space-y-2">
                          {intake.contingentBeneficiaries.map((cb, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3">
                              <span className="flex-1 truncate text-sm font-medium text-navy">
                                {cb.name || `Beneficiary ${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={cb.share}
                                  onChange={(e) => {
                                    const updated = [...intake.contingentBeneficiaries];
                                    updated[idx] = { ...updated[idx], share: e.target.value };
                                    update({ contingentBeneficiaries: updated });
                                  }}
                                  className="w-16 rounded-lg border-2 border-gray-200 px-2 py-1.5 text-center text-sm font-medium focus:border-gold focus:outline-none transition-colors"
                                  placeholder="0"
                                />
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
            <p className="mb-5 text-xs text-charcoal/60 leading-relaxed">
              This person would raise your children if something happened to
              you.
            </p>
            <QuestionLabel required>Guardian name</QuestionLabel>
            <NameInput
              value={intake.guardianName}
              onChange={(v) => update({ guardianName: v })}
            />
            <div className="mt-5">
              <QuestionLabel>Guardian relationship</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">
                {guardianRelOptions.map((opt) => (
                  <ChoiceTile
                    key={opt}
                    label={opt}
                    selected={intake.guardianRelationship === opt}
                    onClick={() => update({ guardianRelationship: opt })}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <QuestionLabel>Successor guardian name</QuestionLabel>
              <NameInput
                value={intake.successorGuardianName}
                onChange={(v) => update({ successorGuardianName: v })}
                optional
                onPartialChange={partialHandler("successor-guardian")}
              />
            </div>
          </>
        );

      case "gifts":
        return (
          <>
            <QuestionLabel>
              Do you wish to be an organ and tissue donor?
            </QuestionLabel>
            <YesNoTiles
              value={intake.organDonation}
              onChange={(v) => update({ organDonation: v })}
            />
            <div className="mt-6">
              <p className="mb-2 text-xs text-charcoal/60">
                For example: &quot;My grandmother&apos;s ring to my daughter
                Sarah&quot;
              </p>
              <QuestionLabel>
                Do you have any specific gifts you&apos;d like to leave?
              </QuestionLabel>
              <YesNoTiles
                value={intake.hasSpecificGifts}
                onChange={(v) =>
                  update({
                    hasSpecificGifts: v,
                    ...(v === "No" ? { specificGiftsDescription: "" } : {}),
                  })
                }
              />
            </div>
            {intake.hasSpecificGifts === "Yes" && (
              <div className="mt-5">
                <QuestionLabel>Describe your specific gifts</QuestionLabel>
                <textarea
                  value={intake.specificGiftsDescription}
                  onChange={(e) =>
                    update({ specificGiftsDescription: e.target.value })
                  }
                  placeholder="Example: My 1967 Ford Mustang to my son James Smith"
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors resize-none"
                />
                <p className="mt-2 text-xs text-charcoal/60">
                  Specific gifts are distributed before the rest of your estate.
                </p>
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

            <Section k="executor" title="Executor" target="executor">
              <Row label="Executor name" value={intake.executorName} />
              <Row label="Relationship" value={intake.executorRelationship} />
              <Row label="Successor executor" value={intake.successorExecutorName} />
              <Row label="Successor relationship" value={intake.successorExecutorRelationship} />
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
              <Row label="Contingent" value={contingentSummary} />
            </Section>

            {hasMinorChildren && (
              <Section k="guardian" title="Guardian" target="guardian">
                <Row label="Guardian name" value={intake.guardianName} />
                <Row label="Relationship" value={intake.guardianRelationship} />
                <Row label="Successor guardian" value={intake.successorGuardianName} />
              </Section>
            )}

            <Section k="gifts" title="Gifts & Healthcare" target="gifts">
              <Row label="Organ donation" value={intake.organDonation} />
              <Row label="Specific gifts" value={intake.hasSpecificGifts} />
              {intake.hasSpecificGifts === "Yes" && (
                <Row label="Description" value={<span className="whitespace-pre-wrap">{intake.specificGiftsDescription}</span>} />
              )}
            </Section>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <PartnerThemedShell showHeader={false}>
    <div className="min-h-screen bg-navy">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-1.5 bg-navy/80">
        <div
          className="h-full bg-gold transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top bar */}
      <div className="fixed top-1.5 left-0 right-0 z-30 flex items-center justify-between px-6 py-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
        >
          <span className="text-lg">&larr;</span> Back
        </button>
        <span className="text-xs text-white/60">
          {safeIndex + 1} of {totalCards}
        </span>
      </div>

      {/* Card area */}
      <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-8">
        <div
          className={`w-full transform transition-all duration-300 ease-out ${activeCardId === "review" ? "max-w-3xl" : "max-w-lg"} ${slideClass}`}
        >
          <div className="rounded-2xl bg-white p-6 md:p-8 shadow-xl">
            <p className="mb-6 text-xs font-medium uppercase tracking-wider text-gold">
              {moduleTitles[activeCardId]}
            </p>

            {activeCardId === "review" && (
              <h2 className="mb-4 text-lg font-bold text-navy">
                Does everything look right?
              </h2>
            )}

            {renderCard()}

            {activeCardId === "review" ? (
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setCurrentCard(0)}
                  className="flex-1 min-h-[44px] rounded-full border-2 border-gray-200 py-3 text-sm font-medium text-navy hover:border-navy transition-colors"
                >
                  Edit Answers
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors shadow-md"
                >
                  Looks Good, Continue
                </button>
              </div>
            ) : (
              <button
                onClick={handleContinue}
                disabled={!isCardComplete() || hasPartialName}
                className={`mt-8 flex w-full min-h-[44px] items-center justify-center rounded-full py-3.5 text-sm font-semibold transition-all ${
                  isCardComplete() && !hasPartialName
                    ? "bg-gold text-white hover:bg-gold/90 shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Continue &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </PartnerThemedShell>
  );
}
