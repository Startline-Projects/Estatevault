"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { type QuizAnswers, initialAnswers, getRecommendation } from "@/lib/quiz-types";
import PartnerThemedShell from "@/components/partner/PartnerThemedShell";
import ChoiceTile from "@/components/quiz/ChoiceTile";
import YesNoTiles from "@/components/quiz/YesNoTiles";
import TextInput from "@/components/quiz/TextInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";
import HardStopCard from "@/components/quiz/HardStopCard";
import ProcessingScreen from "@/components/quiz/ProcessingScreen";
import ResultScreen from "@/components/quiz/ResultScreen";

type Screen = "quiz" | "hardstop" | "processing" | "result";

export default function QuizPage() {
  const [answers, setAnswers] = useState<QuizAnswers>(initialAnswers);
  const [currentCard, setCurrentCard] = useState(0);
  const [screen, setScreen] = useState<Screen>("quiz");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const update = useCallback(
    (updates: Partial<QuizAnswers>) =>
      setAnswers((prev) => ({ ...prev, ...updates })),
    []
  );

  // ── Build the dynamic list of visible cards ──────────────────────
  // Card IDs correspond to the modules. Some are conditional.
  type CardId =
    | "A1"
    | "B1"
    | "B2"
    | "C1"
    | "C2"
    | "C3"
    | "D1"
    | "E1"
    | "F1"
    | "G1";

  const visibleCards: CardId[] = [];

  // Module A
  visibleCards.push("A1");

  // Module B
  visibleCards.push("B1");
  if (answers.hasChildren === "Yes") visibleCards.push("B2");

  // Module C
  visibleCards.push("C1");
  if (answers.ownsRealEstate === "Yes") visibleCards.push("C2");
  visibleCards.push("C3");

  // Module D
  visibleCards.push("D1");

  // Module E
  visibleCards.push("E1");

  // Module F
  visibleCards.push("F1");

  // Module G
  visibleCards.push("G1");

  const totalCards = visibleCards.length;
  const safeIndex = Math.min(currentCard, totalCards - 1);
  const activeCardId = visibleCards[safeIndex];
  const progress = ((safeIndex + 1) / totalCards) * 100;

  // ── Validate current card completeness ───────────────────────────
  function isCardComplete(): boolean {
    switch (activeCardId) {
      case "A1":
        return answers.state !== "" && answers.maritalStatus !== "";
      case "B1":
        return answers.hasChildren !== "";
      case "B2":
        return (
          answers.numberOfChildren !== "" &&
          answers.specialNeedsChildren !== ""
        );
      case "C1":
        return answers.ownsRealEstate !== "";
      case "C2":
        return answers.realEstateOnlyMichigan !== "";
      case "C3":
        return answers.ownsBusiness !== "" && answers.netWorth !== "";
      case "D1":
        return (
          answers.privacyImportant !== "" && answers.charitableGiving !== ""
        );
      case "E1": {
        if (answers.hasExistingPlan === "") return false;
        if (answers.hasExistingPlan === "Yes" && answers.existingPlanAction === "")
          return false;
        return true;
      }
      case "F1":
        return (
          answers.financeManager.trim() !== "" &&
          answers.medicalDecisionMaker.trim() !== "" &&
          answers.childGuardian.trim() !== ""
        );
      case "G1":
        return answers.additionalSituation !== "";
      default:
        return false;
    }
  }

  // ── Check hard stops ─────────────────────────────────────────────
  function checkHardStop(): boolean {
    if (activeCardId === "B2" && answers.specialNeedsChildren === "Yes")
      return true;
    if (
      activeCardId === "G1" &&
      answers.additionalSituation === "I have a family member with special needs"
    )
      return true;
    return false;
  }

  // ── Navigation ───────────────────────────────────────────────────
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

    if (checkHardStop()) {
      setScreen("hardstop");
      return;
    }

    if (safeIndex >= totalCards - 1) {
      setScreen("processing");
      return;
    }

    animateTransition("forward", () => setCurrentCard((c) => c + 1));
  }

  function handleBack() {
    if (safeIndex <= 0) return;
    animateTransition("back", () => setCurrentCard((c) => c - 1));
  }

  // ── Keep currentCard in bounds when cards are removed (conditional skip) ──
  useEffect(() => {
    if (currentCard >= totalCards) {
      setCurrentCard(totalCards - 1);
    }
  }, [totalCards, currentCard]);

  // ── Special screens ──────────────────────────────────────────────
  if (screen === "hardstop") return <HardStopCard />;
  if (screen === "processing")
    return (
      <ProcessingScreen onComplete={() => setScreen("result")} />
    );
  if (screen === "result")
    return (
      <ResultScreen
        recommendation={getRecommendation(answers)}
        answers={answers}
        onUpdateAnswers={update}
      />
    );

  // ── Module titles ────────────────────────────────────────────────
  const moduleTitles: Record<CardId, string> = {
    A1: "Let\u2019s start with you",
    B1: "Tell us about your family",
    B2: "Tell us about your family",
    C1: "Your home and assets",
    C2: "Your home and assets",
    C3: "Your home and assets",
    D1: "What matters to you",
    E1: "Do you have an existing plan?",
    F1: "Your people",
    G1: "One last thing",
  };

  // ── Slide animation classes ──────────────────────────────────────
  const slideClass = animating
    ? direction === "forward"
      ? "translate-x-[-100%] opacity-0"
      : "translate-x-[100%] opacity-0"
    : "translate-x-0 opacity-100";

  // ── Card content renderer ────────────────────────────────────────
  function renderCard() {
    switch (activeCardId) {
      case "A1":
        return (
          <>
            <QuestionLabel>What state do you live in?</QuestionLabel>
            <select
              value={answers.state}
              onChange={(e) => update({ state: e.target.value })}
              className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
            >
              <option value="Michigan">Michigan</option>
              <option value="Other">Other</option>
            </select>

            <div className="mt-6">
              <QuestionLabel>What is your marital status?</QuestionLabel>
              <div className="grid grid-cols-2 gap-3">
                {["Single", "Married", "Divorced", "Widowed"].map((opt) => (
                  <ChoiceTile
                    key={opt}
                    label={opt}
                    selected={answers.maritalStatus === opt}
                    onClick={() => update({ maritalStatus: opt })}
                  />
                ))}
              </div>
            </div>
          </>
        );

      case "B1":
        return (
          <>
            <QuestionLabel>Do you have children?</QuestionLabel>
            <YesNoTiles
              value={answers.hasChildren}
              onChange={(val) =>
                update({
                  hasChildren: val,
                  // Reset child-related fields when toggling
                  ...(val === "No"
                    ? {
                        numberOfChildren: "",
                        specialNeedsChildren: "",
                      }
                    : {}),
                })
              }
            />
          </>
        );

      case "B2":
        return (
          <>
            <QuestionLabel>How many children do you have?</QuestionLabel>
            <div className="grid grid-cols-4 gap-3">
              {["1", "2", "3", "4+"].map((opt) => (
                <ChoiceTile
                  key={opt}
                  label={opt}
                  selected={answers.numberOfChildren === opt}
                  onClick={() => update({ numberOfChildren: opt })}
                />
              ))}
            </div>

            <div className="mt-6">
              <QuestionLabel>
                Do any of your children have special needs?
              </QuestionLabel>
              <YesNoTiles
                value={answers.specialNeedsChildren}
                onChange={(val) => update({ specialNeedsChildren: val })}
              />
            </div>
          </>
        );

      case "C1":
        return (
          <>
            <QuestionLabel>Do you own real estate?</QuestionLabel>
            <YesNoTiles
              value={answers.ownsRealEstate}
              onChange={(val) =>
                update({
                  ownsRealEstate: val,
                  ...(val === "No" ? { realEstateOnlyMichigan: "" } : {}),
                })
              }
            />
          </>
        );

      case "C2":
        return (
          <>
            <QuestionLabel>Is your real estate only in Michigan?</QuestionLabel>
            <YesNoTiles
              value={answers.realEstateOnlyMichigan}
              onChange={(val) => update({ realEstateOnlyMichigan: val })}
            />
          </>
        );

      case "C3":
        return (
          <>
            <QuestionLabel>Do you own a business?</QuestionLabel>
            <YesNoTiles
              value={answers.ownsBusiness}
              onChange={(val) => update({ ownsBusiness: val })}
            />

            <div className="mt-6">
              <QuestionLabel>
                Roughly what is your total net worth?
              </QuestionLabel>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Under $150K",
                  "$150K to $500K",
                  "$500K to $1M",
                  "Over $1M",
                ].map((opt) => (
                  <ChoiceTile
                    key={opt}
                    label={opt}
                    selected={answers.netWorth === opt}
                    onClick={() => update({ netWorth: opt })}
                  />
                ))}
              </div>
            </div>
          </>
        );

      case "D1":
        return (
          <>
            <QuestionLabel>
              Is privacy important to you? (Trusts avoid public probate records)
            </QuestionLabel>
            <YesNoTiles
              value={answers.privacyImportant}
              onChange={(val) => update({ privacyImportant: val })}
            />

            <div className="mt-6">
              <QuestionLabel>
                Do you have any charitable giving intentions?
              </QuestionLabel>
              <YesNoTiles
                value={answers.charitableGiving}
                onChange={(val) => update({ charitableGiving: val })}
              />
            </div>
          </>
        );

      case "E1":
        return (
          <>
            <QuestionLabel>
              Do you currently have a will or trust?
            </QuestionLabel>
            <YesNoTiles
              value={answers.hasExistingPlan}
              onChange={(val) =>
                update({
                  hasExistingPlan: val,
                  ...(val === "No" ? { existingPlanAction: "" } : {}),
                })
              }
            />

            {answers.hasExistingPlan === "Yes" && (
              <div className="mt-6">
                <QuestionLabel>
                  Would you like to replace it or create a new one?
                </QuestionLabel>
                <div className="grid grid-cols-2 gap-3">
                  {["Replace It", "Create New"].map((opt) => (
                    <ChoiceTile
                      key={opt}
                      label={opt}
                      selected={answers.existingPlanAction === opt}
                      onClick={() => update({ existingPlanAction: opt })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case "F1":
        return (
          <>
            <QuestionLabel>
              Who would manage your finances if you were unable to?
            </QuestionLabel>
            <TextInput
              value={answers.financeManager}
              onChange={(val) => update({ financeManager: val })}
              placeholder="Full name"
            />

            <div className="mt-6">
              <QuestionLabel>
                Who would make medical decisions for you?
              </QuestionLabel>
              <TextInput
                value={answers.medicalDecisionMaker}
                onChange={(val) => update({ medicalDecisionMaker: val })}
                placeholder="Full name"
              />
            </div>

            <div className="mt-6">
              <QuestionLabel>
                If you and your spouse both pass away, who would you like to serve as guardian of your minor children?
              </QuestionLabel>
              <TextInput
                value={answers.childGuardian}
                onChange={(val) => update({ childGuardian: val })}
                placeholder="Full name or N/A"
              />
            </div>
          </>
        );

      case "G1":
        return (
          <>
            <QuestionLabel>
              Is there anything else important about your situation?
            </QuestionLabel>
            <div className="grid grid-cols-1 gap-3">
              {[
                "I own a business with partners",
                "I have a family member with special needs",
                "None of the above",
              ].map((opt) => (
                <ChoiceTile
                  key={opt}
                  label={opt}
                  selected={answers.additionalSituation === opt}
                  onClick={() => update({ additionalSituation: opt })}
                />
              ))}
            </div>
          </>
        );

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
        {safeIndex > 0 ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
          >
            <span className="text-lg">&larr;</span> Back
          </button>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
          >
            <span className="text-lg">&larr;</span> Exit
          </Link>
        )}
        <span className="text-xs text-white/60">
          {safeIndex + 1} of {totalCards}
        </span>
      </div>

      {/* Card area */}
      <div className="flex min-h-screen items-center justify-center px-6 pt-16 pb-8">
        <div
          ref={cardRef}
          className={`w-full max-w-lg transform transition-all duration-300 ease-out ${slideClass}`}
        >
          <div className="rounded-2xl bg-white p-6 md:p-8 shadow-xl">
            {/* Module title */}
            <p className="mb-6 text-xs font-medium uppercase tracking-wider text-gold">
              {moduleTitles[activeCardId]}
            </p>

            {/* Card content */}
            {renderCard()}

            {/* Continue button */}
            <button
              onClick={handleContinue}
              disabled={!isCardComplete()}
              className={`mt-8 flex w-full min-h-[44px] items-center justify-center rounded-full py-3.5 text-sm font-semibold transition-all
                ${
                  isCardComplete()
                    ? "bg-gold text-white hover:bg-gold/90 shadow-md"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
            >
              Continue &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
    </PartnerThemedShell>
  );
}
