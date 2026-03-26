"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type WillIntake, initialWillIntake } from "@/lib/will-types";
import ChoiceTile from "@/components/quiz/ChoiceTile";
import YesNoTiles from "@/components/quiz/YesNoTiles";
import TextInput from "@/components/quiz/TextInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";

type Stage = "loading" | "acknowledgment" | "intake" | "redirecting";

export default function WillPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  // Acknowledgment
  const [ackChecked, setAckChecked] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  // Intake
  const [intake, setIntake] = useState<WillIntake>(initialWillIntake);
  const [currentCard, setCurrentCard] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [hasMinorChildren, setHasMinorChildren] = useState(false);

  const update = useCallback(
    (updates: Partial<WillIntake>) =>
      setIntake((prev) => ({ ...prev, ...updates })),
    []
  );

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/signup?redirect=/will");
        return;
      }
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
              update({ guardianName: a.childGuardian });
              setHasMinorChildren(true);
            }
            if (a.hasChildren === "Yes") setHasMinorChildren(true);
          }
        }
      } catch {
        // No quiz data — that's fine
      }

      setStage("acknowledgment");
    }
    checkAuth();
  }, [router, update]);

  // ── Intake card logic ─────────────────────────────────────────
  type CardId = "about" | "executor" | "beneficiaries" | "guardian" | "gifts" | "review";

  const visibleCards: CardId[] = ["about", "executor", "beneficiaries"];
  if (hasMinorChildren) visibleCards.push("guardian");
  visibleCards.push("gifts", "review");

  const totalCards = visibleCards.length;
  const safeIndex = Math.min(currentCard, totalCards - 1);
  const activeCardId = visibleCards[safeIndex];
  const progress = ((safeIndex + 1) / totalCards) * 100;

  function isCardComplete(): boolean {
    switch (activeCardId) {
      case "about":
        return (
          intake.firstName.trim() !== "" &&
          intake.lastName.trim() !== "" &&
          intake.dateOfBirth !== "" &&
          intake.city.trim() !== ""
        );
      case "executor":
        return (
          intake.executorName.trim() !== "" &&
          intake.executorRelationship !== "" &&
          intake.successorExecutorName.trim() !== ""
        );
      case "beneficiaries": {
        const base =
          intake.primaryBeneficiaryName.trim() !== "" &&
          intake.primaryBeneficiaryRelationship !== "" &&
          intake.hasSecondBeneficiary !== "";
        if (!base) return false;
        if (intake.hasSecondBeneficiary === "Yes") {
          if (
            intake.secondBeneficiaryName.trim() === "" ||
            intake.secondBeneficiaryRelationship === "" ||
            intake.estateSplit === ""
          )
            return false;
          if (intake.estateSplit === "Other" && intake.customSplit.trim() === "")
            return false;
        }
        return true;
      }
      case "guardian":
        return (
          intake.guardianName.trim() !== "" &&
          intake.guardianRelationship !== "" &&
          intake.successorGuardianName.trim() !== ""
        );
      case "gifts":
        return (
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
    if (!isCardComplete()) return;
    if (activeCardId === "review") {
      // Save intake to sessionStorage and go to checkout
      sessionStorage.setItem("willIntake", JSON.stringify(intake));
      sessionStorage.setItem("willUserId", userId || "");
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

  // ── LOADING ───────────────────────────────────────────────────
  if (stage === "loading" || stage === "redirecting") {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="animate-pulse text-gold text-xl font-bold">
          EstateVault
        </div>
      </div>
    );
  }

  // ── STAGE 1: ACKNOWLEDGMENT ───────────────────────────────────
  if (stage === "acknowledgment") {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <Link
            href="/"
            className="block text-center text-2xl font-bold text-white mb-8"
          >
            EstateVault
          </Link>

          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <h1 className="text-xl font-bold text-navy">Before We Begin</h1>

            <div className="mt-6 space-y-4 text-sm text-charcoal/70 leading-relaxed">
              <p>
                This platform provides document preparation services only. It
                does not provide legal advice. No attorney-client relationship is
                created by your use of this platform.
              </p>
              <p>
                The documents generated are based solely on the information you
                provide. You are responsible for ensuring all information is
                accurate and complete. You are responsible for properly executing
                your documents in accordance with Michigan law requirements.
              </p>
              <p>
                If your situation is complex, we recommend consulting a licensed
                Michigan estate planning attorney.
              </p>
            </div>

            <label className="mt-8 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ackChecked}
                onChange={(e) => setAckChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-gold"
              />
              <span className="text-sm text-charcoal leading-relaxed">
                I understand and agree that this is a document preparation
                service, not legal advice, and no attorney-client relationship is
                created.
              </span>
            </label>

            <button
              onClick={() => {
                if (!ackChecked) return;
                setAckLoading(true);
                // Acknowledgment saved when order is created at checkout
                setStage("intake");
                setAckLoading(false);
              }}
              disabled={!ackChecked || ackLoading}
              className={`mt-6 w-full min-h-[44px] rounded-full py-3.5 text-sm font-semibold transition-all ${
                ackChecked
                  ? "bg-gold text-white hover:bg-gold/90 shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {ackLoading ? "Loading..." : "I Understand — Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE 2: INTAKE ───────────────────────────────────────────
  const moduleTitles: Record<CardId, string> = {
    about: "About You",
    executor: "Your Executor",
    beneficiaries: "Your Beneficiaries",
    guardian: "Minor Children",
    gifts: "Specific Gifts",
    review: "Final Review",
  };

  function renderCard() {
    switch (activeCardId) {
      case "about":
        return (
          <>
            <QuestionLabel>First name</QuestionLabel>
            <TextInput
              value={intake.firstName}
              onChange={(v) => update({ firstName: v })}
              placeholder="First name"
            />
            <div className="mt-5">
              <QuestionLabel>Last name</QuestionLabel>
              <TextInput
                value={intake.lastName}
                onChange={(v) => update({ lastName: v })}
                placeholder="Last name"
              />
            </div>
            <div className="mt-5">
              <QuestionLabel>Date of birth</QuestionLabel>
              <input
                type="date"
                value={intake.dateOfBirth}
                onChange={(e) => update({ dateOfBirth: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
              />
            </div>
            <div className="mt-5">
              <QuestionLabel>City of residence</QuestionLabel>
              <TextInput
                value={intake.city}
                onChange={(v) => update({ city: v })}
                placeholder="e.g. Grand Rapids"
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
            <QuestionLabel>Executor full name</QuestionLabel>
            <TextInput
              value={intake.executorName}
              onChange={(v) => update({ executorName: v })}
              placeholder="Full name"
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
              <QuestionLabel>Successor executor full name</QuestionLabel>
              <p className="mb-2 text-xs text-charcoal/50">
                Backup if your first choice is unable to serve
              </p>
              <TextInput
                value={intake.successorExecutorName}
                onChange={(v) => update({ successorExecutorName: v })}
                placeholder="Full name"
              />
            </div>
          </>
        );

      case "beneficiaries":
        return (
          <>
            <p className="mb-5 text-xs text-charcoal/60">
              Who should inherit your estate?
            </p>
            <QuestionLabel>Primary beneficiary full name</QuestionLabel>
            <TextInput
              value={intake.primaryBeneficiaryName}
              onChange={(v) => update({ primaryBeneficiaryName: v })}
              placeholder="Full name"
            />
            <div className="mt-5">
              <QuestionLabel>Relationship</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">
                {beneficiaryRelOptions.map((opt) => (
                  <ChoiceTile
                    key={opt}
                    label={opt}
                    selected={intake.primaryBeneficiaryRelationship === opt}
                    onClick={() =>
                      update({ primaryBeneficiaryRelationship: opt })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="mt-5">
              <QuestionLabel>Add another beneficiary?</QuestionLabel>
              <YesNoTiles
                value={intake.hasSecondBeneficiary}
                onChange={(v) =>
                  update({
                    hasSecondBeneficiary: v,
                    ...(v === "No"
                      ? {
                          secondBeneficiaryName: "",
                          secondBeneficiaryRelationship: "",
                          estateSplit: "",
                          customSplit: "",
                        }
                      : {}),
                  })
                }
              />
            </div>
            {intake.hasSecondBeneficiary === "Yes" && (
              <>
                <div className="mt-5">
                  <QuestionLabel>Second beneficiary full name</QuestionLabel>
                  <TextInput
                    value={intake.secondBeneficiaryName}
                    onChange={(v) => update({ secondBeneficiaryName: v })}
                    placeholder="Full name"
                  />
                </div>
                <div className="mt-5">
                  <QuestionLabel>Relationship</QuestionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {beneficiaryRelOptions.map((opt) => (
                      <ChoiceTile
                        key={opt}
                        label={opt}
                        selected={intake.secondBeneficiaryRelationship === opt}
                        onClick={() =>
                          update({ secondBeneficiaryRelationship: opt })
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <QuestionLabel>
                    How would you like to split your estate?
                  </QuestionLabel>
                  <div className="grid grid-cols-3 gap-3">
                    {["50/50", "75/25", "Other"].map((opt) => (
                      <ChoiceTile
                        key={opt}
                        label={opt}
                        selected={intake.estateSplit === opt}
                        onClick={() => update({ estateSplit: opt })}
                      />
                    ))}
                  </div>
                  {intake.estateSplit === "Other" && (
                    <div className="mt-3">
                      <TextInput
                        value={intake.customSplit}
                        onChange={(v) => update({ customSplit: v })}
                        placeholder="e.g. 60/40"
                      />
                    </div>
                  )}
                </div>
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
            <QuestionLabel>Guardian full name</QuestionLabel>
            <TextInput
              value={intake.guardianName}
              onChange={(v) => update({ guardianName: v })}
              placeholder="Full name"
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
              <QuestionLabel>Successor guardian full name</QuestionLabel>
              <TextInput
                value={intake.successorGuardianName}
                onChange={(v) => update({ successorGuardianName: v })}
                placeholder="Full name"
              />
            </div>
          </>
        );

      case "gifts":
        return (
          <>
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
                <p className="mt-2 text-xs text-charcoal/40">
                  Specific gifts are distributed before the rest of your estate.
                </p>
              </div>
            )}
          </>
        );

      case "review":
        return (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-navy">Personal Information</p>
              <p className="text-charcoal/70">
                {intake.firstName} {intake.lastName} &middot;{" "}
                {intake.dateOfBirth} &middot; {intake.city}, Michigan
              </p>
            </div>
            <hr className="border-gray-100" />
            <div>
              <p className="font-medium text-navy">Executor</p>
              <p className="text-charcoal/70">
                {intake.executorName} ({intake.executorRelationship})
              </p>
              <p className="text-charcoal/50 text-xs">
                Backup: {intake.successorExecutorName}
              </p>
            </div>
            <hr className="border-gray-100" />
            <div>
              <p className="font-medium text-navy">Primary Beneficiary</p>
              <p className="text-charcoal/70">
                {intake.primaryBeneficiaryName} (
                {intake.primaryBeneficiaryRelationship})
              </p>
              {intake.hasSecondBeneficiary === "Yes" && (
                <>
                  <p className="text-charcoal/70 mt-1">
                    {intake.secondBeneficiaryName} (
                    {intake.secondBeneficiaryRelationship}) &middot; Split:{" "}
                    {intake.estateSplit === "Other"
                      ? intake.customSplit
                      : intake.estateSplit}
                  </p>
                </>
              )}
            </div>
            {hasMinorChildren && intake.guardianName && (
              <>
                <hr className="border-gray-100" />
                <div>
                  <p className="font-medium text-navy">Guardian</p>
                  <p className="text-charcoal/70">
                    {intake.guardianName} ({intake.guardianRelationship})
                  </p>
                  <p className="text-charcoal/50 text-xs">
                    Backup: {intake.successorGuardianName}
                  </p>
                </div>
              </>
            )}
            {intake.hasSpecificGifts === "Yes" && (
              <>
                <hr className="border-gray-100" />
                <div>
                  <p className="font-medium text-navy">Specific Gifts</p>
                  <p className="text-charcoal/70 whitespace-pre-wrap">
                    {intake.specificGiftsDescription}
                  </p>
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
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
        <span className="text-xs text-white/40">
          {safeIndex + 1} of {totalCards}
        </span>
      </div>

      {/* Card area */}
      <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-8">
        <div
          className={`w-full max-w-lg transform transition-all duration-300 ease-out ${slideClass}`}
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
                  Looks Good — Continue
                </button>
              </div>
            ) : (
              <button
                onClick={handleContinue}
                disabled={!isCardComplete()}
                className={`mt-8 flex w-full min-h-[44px] items-center justify-center rounded-full py-3.5 text-sm font-semibold transition-all ${
                  isCardComplete()
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
  );
}
