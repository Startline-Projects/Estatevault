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

/**
 * The powers offered. All are granted by default: the questionnaire presents
 * them pre-checked and the client unchecks anything they do not want. An
 * unchecked power still renders an explicit NOT GRANTED entry in the document.
 *
 * Gift-making and estate-plan amendment were removed on attorney instruction
 * and are no longer options.
 */
export const ALL_POA_POWERS = [
  "Banking and finances",
  "Real estate transactions",
  "Business operations",
  "Tax filings",
];

/** What a new intake starts with: everything granted. */
export const DEFAULT_POA_POWERS = [...ALL_POA_POWERS];

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
    description: "Your agent does not have authority to act unless you have been deemed incapacitated.",
  },
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
// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// Each `value` maps 1:1 to an {{#IF organ_donation ...}} branch in
// lib/documents/templates/advance-healthcare-directive-michigan-v1.0.0.txt.
export const ORGAN_DONATION_OPTIONS = [
  {
    value: "none",
    label: "No organ donation",
    description: "You do not wish to donate any organ, tissue, or other part of your body.",
  },
  {
    value: "any_purpose",
    label: "Yes, organ donation for any purpose",
    description: "Any needed organ or tissue may be given for any purpose allowed by law.",
  },
  {
    value: "specific_purposes",
    label: "Organ donation for specific purposes",
    description: "You choose which purposes your donation may be used for, and state them below.",
  },
  {
    value: "silent",
    label: "Say nothing about organ donation",
    description: "The document does not address donation, leaving the decision to be made later.",
  },
];

export interface PadFields {
  patientAdvocateName: string;
  patientAdvocateRelationship: string;
  successorPatientAdvocateName: string;
  organDonation: string;
  /** Only meaningful when organDonation is "specific_purposes". */
  organDonationPurposes: string;
  secondSuccessorPatientAdvocateName: string;
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
    i.organDonation !== "" &&
    (i.organDonation !== "specific_purposes" || i.organDonationPurposes.trim() !== "") &&
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
      <div className="mt-5"><QuestionLabel>Second alternate patient advocate</QuestionLabel><NameInput value={intake.secondSuccessorPatientAdvocateName} onChange={(v) => set({ secondSuccessorPatientAdvocateName: v })} optional onPartialChange={partialHandler("second-successor-advocate")} /></div>
      {/* PENDING ATTORNEY APPROVAL — option wording to be confirmed by the
          reviewing attorney. Values map 1:1 to the organ donation branches in
          the Advance Healthcare Directive. */}
      <div className="mt-5"><QuestionLabel required>What are your wishes about organ donation?</QuestionLabel>
        <OptionList options={ORGAN_DONATION_OPTIONS} value={intake.organDonation} onSelect={(v) => set({ organDonation: v, ...(v === "specific_purposes" ? {} : { organDonationPurposes: "" }) })} />
        {intake.organDonation === "specific_purposes" && (
          <div className="mt-3">
            <QuestionLabel required>Which purposes?</QuestionLabel>
            <textarea
              value={intake.organDonationPurposes}
              onChange={(e) => set({ organDonationPurposes: e.target.value })}
              placeholder="Example: transplantation and therapy only."
              rows={3}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors resize-none"
            />
          </div>
        )}
      </div>
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
