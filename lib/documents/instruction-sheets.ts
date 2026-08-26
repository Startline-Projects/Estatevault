/*
 * DOCUMENT GENERATION, ATTORNEY SUPERVISED
 * "Operation of This Document" instruction sheets.
 *
 * These sheets are rendered by generate-pdf.ts as a separate final page (or pages)
 * AFTER all signature and notary pages, for every document type.
 *
 * Content rule: procedural only. Describe how the document is executed, stored, and
 * updated. Never give legal advice, never use "we recommend", never use the word "death".
 *
 * Template Version: 1.0.0-michigan
 * Attorney Approval Date: [TO BE FILLED]
 * Approved By: [TO BE FILLED]
 */

export type InstructionBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string; bold?: boolean }
  | { type: "bullet"; text: string; bold?: boolean }
  | { type: "step"; text: string };

export interface InstructionSheet {
  /** Centered page title. Always the same across every document type. */
  title: string;
  /** Centered subtitle naming the document this sheet belongs to. */
  subtitle: string;
  blocks: InstructionBlock[];
}

export const INSTRUCTION_SHEET_TITLE = "OPERATION OF THIS DOCUMENT";

const CLOSING_BLOCKS: InstructionBlock[] = [
  { type: "heading", text: "Storing and Updating This Document" },
  {
    type: "paragraph",
    text:
      "Keep the signed original in a safe, accessible place, and tell the people named in it where that place is. A copy of every document in your plan is stored in your EstateVault account.",
  },
  {
    type: "paragraph",
    text:
      "Review your plan after any significant change in your family, your assets, or the people you have named. An amendment can be prepared through your EstateVault account.",
  },
  { type: "heading", text: "Important Notice" },
  {
    type: "paragraph",
    text:
      "EstateVault provides document preparation services only. This is not legal advice, and no attorney-client relationship is created. If you have questions about how this document applies to your circumstances, a licensed attorney can assist you.",
  },
];

const SHEETS: Record<string, Omit<InstructionSheet, "title">> = {
  will: {
    subtitle: "Last Will and Testament",
    blocks: [
      { type: "heading", text: "What This Document Does" },
      {
        type: "paragraph",
        text:
          "Your Last Will and Testament directs how your property is distributed, names the Personal Representative who will carry out those directions, and, if you have named one, appoints a guardian for your minor children.",
      },
      { type: "heading", text: "Making This Document Effective" },
      {
        type: "paragraph",
        text:
          "In Michigan, a will requires two witnesses to be valid. A notary section is also included so the will can be self-proved.",
      },
      { type: "step", text: "Read the entire document before signing anything." },
      {
        type: "step",
        text:
          "Gather two adult witnesses who are not named as beneficiaries in this will, and a notary public.",
      },
      {
        type: "step",
        text:
          "You, both witnesses, and the notary must all be together in the same place at the same time.",
      },
      { type: "step", text: "Sign and date the will in the presence of both witnesses." },
      { type: "step", text: "Each witness then signs and prints their name and address in your presence." },
      {
        type: "step",
        text:
          "You and both witnesses sign the notary section, and the notary completes and seals it.",
      },
      { type: "step", text: "Store the signed original and upload a copy to your EstateVault account." },
      ...CLOSING_BLOCKS,
    ],
  },

  trust: {
    subtitle: "Revocable Living Trust",
    blocks: [
      { type: "heading", text: "What This Document Does" },
      {
        type: "paragraph",
        text:
          "Your Revocable Living Trust holds title to the assets you transfer into it, states who manages those assets, and directs how they are distributed. You may amend or revoke it at any time while you are living and able to do so.",
      },
      { type: "heading", text: "Making This Document Effective" },
      { type: "step", text: "Read the entire document before signing anything." },
      { type: "step", text: "Sign and date the trust in the presence of a notary public." },
      { type: "step", text: "The notary completes and seals the notary section." },
      { type: "step", text: "Store the signed original and upload a copy to your EstateVault account." },
      { type: "heading", text: "Funding the Trust" },
      {
        type: "paragraph",
        bold: true,
        text:
          "Assets must be titled into the trust for the trust to work. Funding instructions are included in your Trust Package to assist you with this.",
      },
      {
        type: "paragraph",
        text:
          "A trust that holds nothing, or holds only part of what you own, does not control the assets left outside of it. Work through the funding instructions asset by asset, and keep proof of each transfer in your Vault.",
      },
      ...CLOSING_BLOCKS,
    ],
  },

  pour_over_will: {
    subtitle: "Pour-Over Will",
    blocks: [
      { type: "heading", text: "What This Document Does" },
      {
        type: "paragraph",
        text:
          "Your Pour-Over Will is the companion to your Revocable Living Trust. Any asset that was not transferred into the trust during your lifetime is directed into the trust, so that it is administered and distributed under the trust's terms.",
      },
      { type: "heading", text: "Making This Document Effective" },
      {
        type: "paragraph",
        text:
          "In Michigan, a will requires two witnesses to be valid. A notary section is also included so the will can be self-proved.",
      },
      { type: "step", text: "Read the entire document before signing anything." },
      {
        type: "step",
        text:
          "Gather two adult witnesses who are not named as beneficiaries, and a notary public.",
      },
      {
        type: "step",
        text:
          "You, both witnesses, and the notary must all be together in the same place at the same time.",
      },
      { type: "step", text: "Sign and date the will in the presence of both witnesses." },
      { type: "step", text: "Each witness then signs and prints their name and address in your presence." },
      {
        type: "step",
        text:
          "You and both witnesses sign the notary section, and the notary completes and seals it.",
      },
      { type: "step", text: "Store the signed original and upload a copy to your EstateVault account." },
      { type: "heading", text: "This Document Works With Your Trust" },
      {
        type: "paragraph",
        text:
          "The Pour-Over Will is a safety net, not a substitute for funding your trust. Assets that pass through this will must still go through probate before reaching the trust.",
      },
      ...CLOSING_BLOCKS,
    ],
  },

  poa: {
    subtitle: "Durable Power of Attorney",
    blocks: [
      { type: "heading", text: "What This Document Does" },
      {
        type: "paragraph",
        text:
          "Your Durable Power of Attorney authorizes the Agent you named to handle financial and property matters on your behalf. It is durable, which means it remains in force if you later become unable to manage your own affairs.",
      },
      { type: "heading", text: "Making This Document Effective" },
      { type: "step", text: "Read the entire document before signing anything." },
      { type: "step", text: "Sign and date the document in the presence of a notary public." },
      { type: "step", text: "The notary completes and seals the notary section." },
      {
        type: "step",
        text:
          "Give a signed copy to your Agent, and to any bank or institution that will be asked to accept it.",
      },
      { type: "step", text: "Store the signed original and upload a copy to your EstateVault account." },
      { type: "heading", text: "Revoking This Document" },
      {
        type: "paragraph",
        text:
          "You may revoke this power of attorney at any time by giving written notice to your Agent, and by notifying any institution that has been relying on it.",
      },
      ...CLOSING_BLOCKS,
    ],
  },

  healthcare_directive: {
    subtitle: "Patient Advocate Designation",
    blocks: [
      { type: "heading", text: "What This Document Does" },
      {
        type: "paragraph",
        text:
          "Your Patient Advocate Designation names the person who will make medical and care decisions for you if you become unable to participate in those decisions yourself, and records your wishes about the care you want to receive.",
      },
      { type: "heading", text: "Making This Document Effective" },
      {
        type: "paragraph",
        text:
          "Michigan requires two witnesses. A witness cannot be your patient advocate or successor advocate, your spouse, parent, child, grandchild or sibling, a presumptive heir, or an employee of a facility where you are receiving care.",
      },
      { type: "step", text: "Read the entire document before signing anything." },
      { type: "step", text: "Gather two adult witnesses who meet the requirements above." },
      { type: "step", text: "Sign and date the designation in the presence of both witnesses." },
      { type: "step", text: "Each witness then signs and prints their name and address in your presence." },
      {
        type: "step",
        text:
          "Your patient advocate signs the acceptance page. The designation gives your advocate no authority until that acceptance is signed.",
      },
      {
        type: "step",
        text:
          "Give a signed copy to your patient advocate, your successor advocate, and your primary care physician.",
      },
      { type: "step", text: "Store the signed original and upload a copy to your EstateVault account." },
      { type: "heading", text: "When Your Advocate May Act" },
      {
        type: "paragraph",
        text:
          "Your patient advocate may act only after your attending physician and one other physician have examined you and determined that you are unable to participate in medical treatment decisions. Authority to withhold or withdraw life-sustaining treatment applies only if you specifically granted it in this document.",
      },
      ...CLOSING_BLOCKS,
    ],
  },
};

/**
 * Returns the "Operation of This Document" sheet for a document type.
 * Every one of the five templates has a sheet; unknown types fall back to null
 * so the renderer simply omits the page rather than printing a wrong one.
 */
export function getInstructionSheet(documentType: string): InstructionSheet | null {
  const sheet = SHEETS[documentType];
  if (!sheet) return null;
  return { title: INSTRUCTION_SHEET_TITLE, ...sheet };
}
