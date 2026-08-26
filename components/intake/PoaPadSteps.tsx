"use client";

/*
 * The Power of Attorney and Patient Advocate questionnaire steps.
 *
 * Both the will flow and the trust flow ask these identical questions, and the
 * language is attorney-reviewed. Rather than keep two copies that can drift
 * apart, both flows render these components, so the wording, options, and
 * completeness rules have exactly one definition.
 */

import { ReactNode } from "react";
import ChoiceTile from "@/components/quiz/ChoiceTile";
import NameInput from "@/components/quiz/NameInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";
import YesNoTiles from "@/components/quiz/YesNoTiles";

export const ALL_POA_POWERS = [
  "Banking and finances",
  "Real estate transactions",
  "Business operations",
  "Tax filings",
];

export const POA_REL_OPTIONS = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Friend", "Other"];

// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// `value` must stay in 1:1 correspondence with the {{#IF dpoa_effective ...}}
// branches in lib/documents/templates/dpoa-michigan-v1.1.0.txt.
export const POA_EFFECTIVE_OPTIONS = [
  {
    value: "immediate",
    label: "Immediately, as soon as I sign",
    description: "Your agent can act on your behalf right away, even while you are managing your own affairs.",
  },
  {
    value: "springing",
    label: "Only if I become unable to manage my own affairs",
    description: "Your agent has no authority unless and until a physician certifies in writing that you cannot manage your finances.",
  },
];

// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// Each `value` maps 1:1 to a {{#IF life_sustaining_treatment_preference ...}}
// branch in lib/documents/templates/pad-michigan-v1.1.0.txt.
export const LIFE_SUSTAINING_OPTIONS = [
  { value: "continue_all", label: "Continue all treatment", description: "Keep all life-sustaining treatment going in every circumstance." },
  { value: "withhold_if_terminal", label: "Stop if I have a terminal condition", description: "An incurable condition with no reasonable likelihood of recovery." },
  { value: "withhold_if_pvs", label: "Stop if I am permanently unconscious", description: "A persistent vegetative state, with no awareness of myself or my surroundings." },
  { value: "withhold_if_terminal_or_pvs", label: "Stop if either applies", description: "A terminal condition or permanent unconsciousness." },
  { value: "advocate_decides", label: "Leave the decision to my patient advocate", description: "No set preference; your advocate decides in your best interest." },
];

// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// Michigan treats artificial nutrition and hydration separately from other
// life-sustaining treatment, so it is asked separately.
export const ARTIFICIAL_NUTRITION_OPTIONS = [
  { value: "provide_all", label: "Provide in all circumstances", description: "Continue food and water by feeding tube or IV regardless of my condition." },
  { value: "withhold_if_terminal", label: "Stop if I have a terminal condition", description: "An incurable condition with no reasonable likelihood of recovery." },
  { value: "withhold_if_pvs", label: "Stop if I am permanently unconscious", description: "A persistent vegetative state, with no awareness of myself or my surroundings." },
  { value: "withhold_if_terminal_or_pvs", label: "Stop if either applies", description: "A terminal condition or permanent unconsciousness." },
  { value: "advocate_decides", label: "Leave the decision to my patient advocate", description: "No set preference; your advocate decides in your best interest." },
];

/** The POA answers every flow collects. Both intake types satisfy this. */
export interface PoaFields {
  poaAgentName: string;
  poaAgentRelationship: string;
  poaSuccessorAgentName: string;
  poaSuccessorAgentRelationship: string;
  poaPowers: string[];
  poaEffective: string;
}

/** The patient-advocate answers every flow collects. */
export interface PadFields {
  patientAdvocateName: string;
  patientAdvocateRelationship: string;
  successorPatientAdvocateName: string;
  lifeSustainingTreatment: string;
  artificialNutrition: string;
  organDonation: string;
  hasHealthcareWishes: string;
  healthcareWishesDescription: string;
}

/** Step completeness — the single definition both flows advance on. */
export function isPoaStepComplete(i: PoaFields): boolean {
  return (
    i.poaAgentName.trim() !== "" &&
    i.poaAgentRelationship !== "" &&
    i.poaPowers.length > 0 &&
    i.poaEffective !== ""
  );
}

export function isPadStepComplete(i: PadFields): boolean {
  return (
    i.patientAdvocateName.trim() !== "" &&
    i.patientAdvocateRelationship !== "" &&
    i.lifeSustainingTreatment !== "" &&
    i.artificialNutrition !== "" &&
    i.organDonation !== "" &&
    i.hasHealthcareWishes !== "" &&
    (i.hasHealthcareWishes === "No" || i.healthcareWishesDescription.trim() !== "")
  );
}

/** Toggle rule for the powers checklist. Banking is mandatory. */
export function togglePoaPower(current: string[], power: string): string[] {
  if (power === "Banking and finances") return current;
  if (power === "All of the above") {
    return current.length === ALL_POA_POWERS.length ? ["Banking and finances"] : [...ALL_POA_POWERS];
  }
  return current.includes(power) ? current.filter((p) => p !== power) : [...current, power];
}

const tileClass = (selected: boolean) =>
  `min-h-[44px] w-full rounded-xl border-2 px-5 py-3.5 text-left transition-all ${
    selected ? "border-gold bg-gold/10 text-navy" : "border-gray-200 bg-white text-charcoal hover:border-gold/40"
  }`;

function OptionList({
  options,
  value,
  onSelect,
}: {
  options: Array<{ value: string; label: string; description: string }>;
  value: string;
  onSelect: (v: string) => void;
}): ReactNode {
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onSelect(opt.value)} className={tileClass(value === opt.value)}>
          <span className="block text-sm font-medium">{opt.label}</span>
          <span className="mt-1 block text-xs text-charcoal/60">{opt.description}</span>
        </button>
      ))}
    </div>
  );
}

export function PoaStep<T extends PoaFields>({
  intake,
  update,
  partialHandler,
}: {
  intake: T;
  update: (u: Partial<T>) => void;
  partialHandler: (key: string) => (partial: boolean) => void;
}) {
  const set = (u: Partial<PoaFields>) => update(u as Partial<T>);
  return (
    <>
      <p className="mb-5 text-xs text-charcoal/60">This person manages your finances if you become incapacitated.</p>
      <QuestionLabel required>Agent name</QuestionLabel>
      <NameInput value={intake.poaAgentName} onChange={(v) => set({ poaAgentName: v })} />
      <div className="mt-5"><QuestionLabel>Agent relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{POA_REL_OPTIONS.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.poaAgentRelationship === opt} onClick={() => set({ poaAgentRelationship: opt })} />))}</div></div>
      <div className="mt-5">
        <QuestionLabel>Successor agent name</QuestionLabel>
        <NameInput
          value={intake.poaSuccessorAgentName}
          onChange={(v) => {
            set({ poaSuccessorAgentName: v });
            if (!v) set({ poaSuccessorAgentRelationship: "" });
          }}
          optional
          onPartialChange={partialHandler("poa-successor")}
        />
        {intake.poaSuccessorAgentName.trim() !== "" && (
          <div className="mt-3">
            <QuestionLabel>Successor agent relationship</QuestionLabel>
            <div className="grid grid-cols-2 gap-3">
              {POA_REL_OPTIONS.map((opt) => (
                <ChoiceTile key={opt} label={opt} selected={intake.poaSuccessorAgentRelationship === opt} onClick={() => set({ poaSuccessorAgentRelationship: opt })} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-5"><QuestionLabel>Powers granted</QuestionLabel>
        <div className="space-y-3">
          {ALL_POA_POWERS.map((power) => (
            <button key={power} type="button" onClick={() => set({ poaPowers: togglePoaPower(intake.poaPowers, power) })}
              className={`${tileClass(intake.poaPowers.includes(power))} text-sm font-medium ${power === "Banking and finances" ? "opacity-80" : ""}`}>
              <span className="mr-2">{intake.poaPowers.includes(power) ? "☑" : "☐"}</span>{power}{power === "Banking and finances" ? " (required)" : ""}
            </button>
          ))}
          <button type="button" onClick={() => set({ poaPowers: togglePoaPower(intake.poaPowers, "All of the above") })}
            className={`${tileClass(intake.poaPowers.length === ALL_POA_POWERS.length)} text-sm font-medium`}>
            <span className="mr-2">{intake.poaPowers.length === ALL_POA_POWERS.length ? "☑" : "☐"}</span>All of the above
          </button>
        </div>
      </div>
      {/* PENDING ATTORNEY APPROVAL — option wording to be confirmed by the
          reviewing attorney. The two values map 1:1 to the branches in
          Article III of dpoa-michigan-v1.1.0. */}
      <div className="mt-5"><QuestionLabel>When should your agent be able to act?</QuestionLabel>
        <OptionList options={POA_EFFECTIVE_OPTIONS} value={intake.poaEffective} onSelect={(v) => set({ poaEffective: v })} />
      </div>
    </>
  );
}

export function PadStep<T extends PadFields>({
  intake,
  update,
  partialHandler,
}: {
  intake: T;
  update: (u: Partial<T>) => void;
  partialHandler: (key: string) => (partial: boolean) => void;
}) {
  const set = (u: Partial<PadFields>) => update(u as Partial<T>);
  return (
    <>
      <p className="mb-5 text-xs text-charcoal/60">This person makes medical decisions for you if you cannot make them yourself.</p>
      <QuestionLabel required>Patient advocate name</QuestionLabel>
      <NameInput value={intake.patientAdvocateName} onChange={(v) => set({ patientAdvocateName: v })} />
      <div className="mt-5"><QuestionLabel>Relationship</QuestionLabel><div className="grid grid-cols-2 gap-3">{POA_REL_OPTIONS.map((opt) => (<ChoiceTile key={opt} label={opt} selected={intake.patientAdvocateRelationship === opt} onClick={() => set({ patientAdvocateRelationship: opt })} />))}</div></div>
      <div className="mt-5"><QuestionLabel>Successor patient advocate</QuestionLabel><NameInput value={intake.successorPatientAdvocateName} onChange={(v) => set({ successorPatientAdvocateName: v })} optional onPartialChange={partialHandler("successor-advocate")} /></div>
      {/* PENDING ATTORNEY APPROVAL — option wording to be confirmed by the
          reviewing attorney. Values map 1:1 to Article V of the PAD template. */}
      <div className="mt-5"><QuestionLabel>If you could not recover, what should happen to life-sustaining treatment?</QuestionLabel>
        <p className="mb-3 text-xs text-charcoal/60 leading-relaxed">Life-sustaining treatment means things like a breathing machine or CPR. Your advocate can only act on this if a physician has determined you cannot take part in the decision yourself.</p>
        <OptionList options={LIFE_SUSTAINING_OPTIONS} value={intake.lifeSustainingTreatment} onSelect={(v) => set({ lifeSustainingTreatment: v })} />
      </div>
      {/* PENDING ATTORNEY APPROVAL — asked separately because Michigan law
          treats artificial nutrition and hydration separately. */}
      <div className="mt-5"><QuestionLabel>And what about food and water given through a tube or IV?</QuestionLabel>
        <p className="mb-3 text-xs text-charcoal/60 leading-relaxed">Michigan law treats this separately from other life-sustaining treatment, so it is a separate choice.</p>
        <OptionList options={ARTIFICIAL_NUTRITION_OPTIONS} value={intake.artificialNutrition} onSelect={(v) => set({ artificialNutrition: v })} />
      </div>
      <div className="mt-5"><QuestionLabel>Do you wish to be an organ and tissue donor?</QuestionLabel><YesNoTiles value={intake.organDonation} onChange={(v) => set({ organDonation: v })} /></div>
      <div className="mt-5"><QuestionLabel>Do you have specific healthcare wishes to document?</QuestionLabel><YesNoTiles value={intake.hasHealthcareWishes} onChange={(v) => set({ hasHealthcareWishes: v, ...(v === "No" ? { healthcareWishesDescription: "" } : {}) })} /></div>
      {intake.hasHealthcareWishes === "Yes" && (
        <div className="mt-5">
          <textarea value={intake.healthcareWishesDescription} onChange={(e) => set({ healthcareWishesDescription: e.target.value })} placeholder="Example: I do not wish to be kept on life support if there is no reasonable chance of recovery." rows={4} className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors resize-none" />
          <p className="mt-2 text-xs text-charcoal/60">This is your personal instruction, it guides your advocate&apos;s decisions.</p>
        </div>
      )}
    </>
  );
}
