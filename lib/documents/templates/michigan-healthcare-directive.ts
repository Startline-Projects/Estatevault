/*
 * DOCUMENT GENERATION — ATTORNEY SUPERVISED
 * All document templates and Claude prompts used in this file have been reviewed and
 * approved by a licensed Michigan estate planning attorney before deployment.
 * Claude generates document content based on structured client intake data.
 * The AI operates within attorney-approved template constraints.
 * This system provides document preparation services only. It does not provide legal advice.
 * No attorney-client relationship is created.
 * Template Version: 1.0.0-michigan
 * Attorney Approval Date: [TO BE FILLED]
 * Approved By: [TO BE FILLED]
 */

export const hcdSystemPrompt = `You are a legal document drafting assistant. You draft Michigan Patient Advocate Designation documents following MCL 700.5506 and the Michigan Estates and Protected Individuals Code (EPIC).

CRITICAL RULES:
- You are NOT an attorney. You do NOT provide legal advice.
- You generate document text based on structured client intake data within attorney-approved template constraints.
- Frame all language around protection and care, never use the word "death." Use phrases like "end of life," "if I am unable to communicate," or "in the event I cannot make decisions for myself."
- Never use "We recommend" language. Use "Based on your answers" if referencing client choices.

DOCUMENT REQUIREMENTS:
1. Opening declaration identifying the patient and establishing this as a Patient Advocate Designation under MCL 700.5506.
2. Patient advocate (agent) appointment with full legal name, relationship, and successor advocate.
3. Powers granted to the patient advocate:
   - Make healthcare decisions when the patient is unable to participate in medical treatment decisions
   - Access medical records and information
   - Consent to or refuse medical treatment
   - Authorize admission to or discharge from healthcare facilities
   - Make decisions regarding life-sustaining treatment (if the patient elects to grant this power)
4. Life-sustaining treatment provisions: Include a clear statement of the patient's wishes regarding:
   - Mechanical ventilation
   - Artificial nutrition and hydration
   - Cardiopulmonary resuscitation
   - Other life-sustaining measures
   The patient advocate may only exercise authority to withhold or withdraw treatment that would allow the patient to pass if the patient has specifically authorized it AND the patient's physician and one other physician have examined the patient and determined that the patient is unable to participate in treatment decisions.
5. Organ donation clause: State whether the patient wishes to be an organ and tissue donor upon passing, and if so, specify any limitations.
6. Advocate acceptance: The patient advocate must sign acceptance of the designation, acknowledging their duties.
7. WITNESS REQUIREMENTS (MCL 700.5506):
   - TWO witnesses are required
   - Witnesses CANNOT be:
     a) The designated patient advocate or successor advocate
     b) A healthcare provider or employee of a healthcare facility where the patient is receiving care
     c) The patient's spouse, parent, child, grandchild, or sibling
     d) A presumptive heir of the patient
   - Include a witness attestation statement that each witness meets these requirements
8. Revocation clause: The patient may revoke this designation at any time.
9. HIPAA authorization clause permitting the advocate to access protected health information.
10. Governing law: This document shall be governed by the laws of the State of Michigan.

NOTARY RULES:
- Do NOT include any county name (such as "Wayne County," "Oakland County," etc.) anywhere in the document body, notary acknowledgment, or witness sections. Leave county fields blank.
- Do NOT write out full notary acknowledgment language — use [NOTARY BLOCK] placeholder only.

OUTPUT FORMAT:
- Return PLAIN TEXT only. Do NOT use any markdown formatting. No pound signs (#), no asterisks (**), no dashes for rules (---), no backticks. Use ALL CAPS for section headers.
- Use numbered sections (Section 1, Section 2, etc.) for major provisions.
- Use [SIGNATURE LINE] where the patient signs.
- Use [DATE LINE] where the date of signing goes.
- For witness blocks use EXACTLY: [WITNESS SIGNATURE] on its own line. Include two witness blocks. Do not add additional labels or headers around witness blocks.
- Include witness disqualification attestation statements in the body text.
- Include an advocate acceptance section with [SIGNATURE LINE] for the advocate.
- Use [NOTARY BLOCK] EXACTLY ONCE at the end of the document. Do NOT write out notary acknowledgment language in the document body — the platform renders this automatically.
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete Patient Advocate Designation text ready for formatting.`;

export function buildHCDPrompt(intake: Record<string, unknown>): string {
  const i = intake;
  const full_name = (i.full_name || `${i.firstName || ""} ${i.lastName || ""}`.trim()) as string;
  const city = (i.city || "") as string;
  const advocate_name = (i.advocate_name || i.patientAdvocateName || i.medicalDecisionMaker || "") as string;
  const advocate_relationship = (i.advocate_relationship || i.patientAdvocateRelationship || "") as string;
  const successor_advocate = (i.successor_advocate || i.successorPatientAdvocateName || "") as string;
  const healthcare_wishes = (i.healthcare_wishes || (i.hasHealthcareWishes === "Yes" ? i.healthcareWishesDescription : "") || "") as string;
  const organ_donation = (i.organ_donation || i.organDonation || "") as string;

  let prompt = `Draft a Michigan Patient Advocate Designation with the following client intake data:

PATIENT INFORMATION:
- Full Legal Name: ${full_name}
- City of Residence: ${city}, Michigan

PATIENT ADVOCATE APPOINTMENT:
- Primary Patient Advocate: ${advocate_name} (${advocate_relationship})
- Successor Patient Advocate: ${successor_advocate}

ORGAN DONATION:
${organ_donation === "Yes" ? "- The patient WISHES to be an organ and tissue donor with no specific limitations." : organ_donation === "No" ? "- The patient does NOT wish to be an organ or tissue donor." : "- The patient has not specified an organ donation preference. Do not include any organ donation language."}

HEALTHCARE WISHES:`;

  if (healthcare_wishes && healthcare_wishes.trim().length > 0) {
    prompt += `\n${healthcare_wishes}`;
  } else {
    prompt += `\n- The patient wishes to grant full authority to the patient advocate to make healthcare decisions, including decisions regarding life-sustaining treatment, in accordance with what the advocate believes the patient would have wanted.`;
  }

  prompt += `\n\nGenerate the complete Patient Advocate Designation document text now. Include all required sections, signature blocks, two witness attestation blocks with disqualification statements, advocate acceptance, HIPAA authorization, and notary block.`;

  return prompt;
}
