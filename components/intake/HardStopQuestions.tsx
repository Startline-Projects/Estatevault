"use client";

/*
 * Core Rule 4 hard-stop questions.
 *
 * The platform has three hard stops. The special-needs question is asked on the
 * About You step itself; the other two — Medicaid planning and a contested
 * estate — were promised on the marketing pages with nothing asking, and are
 * asked here. Each answer maps 1:1 to a branch of evaluateHardStop().
 *
 * There used to be a third question here, "Are you looking to create an
 * irrevocable trust?". It was removed on 2026-09-18 by the founder's decision:
 * irrevocable trust is no longer a hard stop (see CLAUDE.md, Core Rule 4). Do
 * not restore it.
 *
 * A "Yes" to any of them stops the flow and routes to an attorney, so none of
 * them has a default and none may be skipped.
 */

import QuestionLabel from "@/components/quiz/QuestionLabel";
import YesNoTiles from "@/components/quiz/YesNoTiles";

// PENDING ATTORNEY APPROVAL — question wording and the explanatory lines below
// are the development team's. Logged in PENDING_ATTORNEY_REVIEW.md.
export const HARD_STOP_QUESTIONS = [
  {
    field: "hasMedicaidPlanning" as const,
    question: "Are you planning for Medicaid or long-term care costs?",
    help: "Medicaid has rules about how and when assets can be transferred. Those rules affect what your documents should say.",
  },
  {
    field: "hasEstateDispute" as const,
    question: "Is there a disagreement in your family about your estate?",
    help: "For example, a contested will, a dispute over who should inherit, or a court matter that is already underway.",
  },
];

export type HardStopField = (typeof HARD_STOP_QUESTIONS)[number]["field"];

export type HardStopAnswers = Record<HardStopField, string>;

/** True once every hard-stop question has an answer. */
export function hardStopQuestionsAnswered(intake: Partial<HardStopAnswers>): boolean {
  return HARD_STOP_QUESTIONS.every((q) => (intake[q.field] ?? "") !== "");
}

export function HardStopQuestions({
  intake,
  onChange,
}: {
  intake: Partial<HardStopAnswers>;
  onChange: (patch: Partial<HardStopAnswers>) => void;
}) {
  return (
    <>
      {HARD_STOP_QUESTIONS.map((q) => (
        <div key={q.field} className="mt-5">
          <QuestionLabel required>{q.question}</QuestionLabel>
          <p className="mb-2 text-xs text-charcoal/60">{q.help}</p>
          <YesNoTiles
            value={intake[q.field] ?? ""}
            onChange={(v) => onChange({ [q.field]: v } as Partial<HardStopAnswers>)}
          />
        </div>
      ))}
    </>
  );
}
