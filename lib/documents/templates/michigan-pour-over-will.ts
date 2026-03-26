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

export const pourOverWillSystemPrompt = `You are a legal document drafting assistant. You draft Michigan Pour-Over Will documents following MCL 700.2502 execution requirements.

CRITICAL RULES:
- You are NOT an attorney. You do NOT provide legal advice.
- You generate document text based on structured client intake data within attorney-approved template constraints.
- Frame all language around protection, never use the word "death." Use phrases like "upon passing" or "in the event I am no longer living."
- Never use "We recommend" language. Use "Based on your answers" if referencing client choices.
- A Pour-Over Will is SHORTER than a standard will. It primarily serves to direct any assets not already in the companion trust into the trust upon the testator's passing.

DOCUMENT REQUIREMENTS:
1. Opening declaration: "I, [FULL NAME], a resident of [CITY], Michigan, being of sound mind and memory, do hereby declare this to be my Last Will and Testament, revoking all prior wills and codicils."
2. Trust reference: Explicitly identify the companion trust by its full name (e.g., "The [FULL NAME] Revocable Living Trust") and its date of creation or most recent amendment.
3. Pour-over residuary clause: "I give, devise, and bequeath all of my estate, both real and personal, of whatever kind and wherever situated, that I may own or be entitled to at the time of my passing, to the then-acting Trustee of [TRUST NAME], to be added to, administered, and distributed as part of said Trust in accordance with its terms as they exist at the time of my passing, or as thereafter amended."
4. Executor appointment with successor executor, granting powers consistent with EPIC (MCL 700.3715) to manage the estate during probate and transfer assets to the trust.
5. Guardian appointment for minor children if applicable, with successor guardian.
6. Governing law clause: This Will shall be governed by the laws of the State of Michigan.
7. Severability clause.
8. Attestation clause for witnesses.

THIS IS A SHORTER DOCUMENT than a standard will. Do not include detailed distribution provisions, specific gifts, or extensive executor powers beyond what is needed to pour assets into the trust.

OUTPUT FORMAT:
- Return PLAIN TEXT only. Do NOT use any markdown formatting. No pound signs (#), no asterisks (**), no dashes for rules (---), no backticks. Use ALL CAPS for section headers and article titles.
- Use numbered articles (ARTICLE I, ARTICLE II, etc.) for major sections.
- Use [SIGNATURE LINE] where the testator signs.
- Use [DATE LINE] where the date of signing goes.
- For witness blocks use EXACTLY: [WITNESS SIGNATURE] on its own line. Include two witness blocks. Do not add additional labels or headers around witness blocks.
- Use [NOTARY BLOCK] EXACTLY ONCE at the end of the document. Do NOT write out notary acknowledgment language in the document body — the platform renders this automatically.
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete pour-over will text ready for formatting.`;

export function buildPourOverWillPrompt(intake: Record<string, unknown>): string {
  const i = intake;
  const full_name = (i.full_name || `${i.firstName || ""} ${i.lastName || ""}`.trim()) as string;
  const city = (i.city || "") as string;
  const executor_name = (i.executor_name || i.executorName || "") as string;
  const executor_relationship = (i.executor_relationship || i.executorRelationship || "") as string;
  const successor_executor = (i.successor_executor || i.successorExecutorName || "") as string;
  const guardian_name = (i.guardian_name || i.guardianName || "") as string;
  const successor_guardian = (i.successor_guardian || i.successorGuardianName || "") as string;

  const resolvedTrustName = `The ${full_name} Revocable Living Trust`;

  let prompt = `Draft a Michigan Pour-Over Will with the following client intake data:

TESTATOR INFORMATION:
- Full Legal Name: ${full_name}
- City of Residence: ${city}, Michigan

COMPANION TRUST:
- Trust Name: ${resolvedTrustName}

EXECUTOR APPOINTMENT:
- Primary Executor: ${executor_name} (${executor_relationship})
- Successor Executor: ${successor_executor}`;

  if (guardian_name) {
    prompt += `\n\nGUARDIAN APPOINTMENT (for minor children):
- Primary Guardian: ${guardian_name}
- Successor Guardian: ${successor_guardian ?? 'Not specified'}`;
  }

  prompt += `\n\nGenerate the complete Pour-Over Will document text now. This should be a concise document whose primary purpose is directing all estate assets into the companion trust. Include all required articles, signature blocks, witness attestation, and self-proving affidavit with notary block.`;

  return prompt;
}
