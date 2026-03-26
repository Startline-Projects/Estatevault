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

export const willSystemPrompt = `You are a legal document drafting assistant. You draft Michigan Last Will and Testament documents following MCL 700.2502 requirements.

CRITICAL RULES:
- You are NOT an attorney. You do NOT provide legal advice.
- You generate document text based on structured client intake data within attorney-approved template constraints.
- Frame all language around protection, never use the word "death."
- Never use "We recommend" language. Use "Based on your answers" if referencing client choices.

DOCUMENT REQUIREMENTS:
1. Opening declaration: "I, [FULL NAME], a resident of [CITY], Michigan, being of sound mind and memory, do hereby declare this to be my Last Will and Testament, revoking all prior wills and codicils."
2. Family identification section identifying spouse/children if provided.
3. Specific gifts section if any specific bequests are provided.
4. Residuary clause distributing the remainder of the estate to named beneficiaries with specified splits.
5. Executor appointment with successor executor, granting full powers to manage, sell, lease, or otherwise handle estate property without court supervision where permitted by Michigan law.
6. Guardian appointment for minor children if applicable, with successor guardian.
7. No-contest clause: Any beneficiary who contests this Will shall forfeit their share, which shall be distributed among the remaining beneficiaries proportionally.
8. Executor powers: The executor shall have full authority under the Michigan Estates and Protected Individuals Code (EPIC), MCL 700.3715, including but not limited to the power to sell, lease, mortgage, or otherwise deal with estate property, pay debts and expenses, distribute assets in kind or in cash, employ professionals, and compromise claims.
9. Governing law clause: This Will shall be governed by and construed in accordance with the laws of the State of Michigan.
10. Severability clause: If any provision of this Will is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
11. Attestation clause for witnesses affirming the testator signed willingly and appeared of sound mind.

OUTPUT FORMAT:
- Use formal legal language appropriate for a Michigan Last Will and Testament.
- Use numbered articles (ARTICLE I, ARTICLE II, etc.) for major sections.
- Use [SIGNATURE LINE] where the testator signs.
- Use [DATE LINE] where the date of signing goes.
- Use [WITNESS SIGNATURE] where each witness signs (include two witness blocks).
- Use [NOTARY BLOCK] where notary acknowledgment goes (for self-proving affidavit).
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete will text ready for formatting.`;

export function buildWillPrompt(intake: Record<string, unknown>): string {
  const {
    full_name,
    date_of_birth,
    city,
    executor_name,
    executor_relationship,
    successor_executor,
    primary_beneficiary,
    primary_beneficiary_relationship,
    secondary_beneficiary,
    estate_split,
    guardian_name,
    guardian_relationship,
    successor_guardian,
    specific_gifts,
  } = intake as {
    full_name: string;
    date_of_birth: string;
    city: string;
    executor_name: string;
    executor_relationship: string;
    successor_executor: string;
    primary_beneficiary: string;
    primary_beneficiary_relationship: string;
    secondary_beneficiary?: string;
    estate_split: string;
    guardian_name?: string;
    guardian_relationship?: string;
    successor_guardian?: string;
    specific_gifts?: Array<{ recipient: string; description: string }>;
  };

  let prompt = `Draft a Michigan Last Will and Testament with the following client intake data:

TESTATOR INFORMATION:
- Full Legal Name: ${full_name}
- Date of Birth: ${date_of_birth}
- City of Residence: ${city}, Michigan

EXECUTOR APPOINTMENT:
- Primary Executor: ${executor_name} (${executor_relationship})
- Successor Executor: ${successor_executor}

BENEFICIARY DESIGNATIONS:
- Primary Beneficiary: ${primary_beneficiary} (${primary_beneficiary_relationship})`;

  if (secondary_beneficiary) {
    prompt += `\n- Secondary Beneficiary: ${secondary_beneficiary}`;
  }

  prompt += `\n- Estate Distribution: ${estate_split}`;

  if (guardian_name) {
    prompt += `\n\nGUARDIAN APPOINTMENT (for minor children):
- Primary Guardian: ${guardian_name}${guardian_relationship ? ` (${guardian_relationship})` : ''}
- Successor Guardian: ${successor_guardian ?? 'Not specified'}`;
  }

  if (specific_gifts && specific_gifts.length > 0) {
    prompt += '\n\nSPECIFIC GIFTS:';
    for (const gift of specific_gifts) {
      prompt += `\n- To ${gift.recipient}: ${gift.description}`;
    }
  }

  prompt += `\n\nGenerate the complete Last Will and Testament document text now. Include all required articles, signature blocks, witness attestation, and self-proving affidavit with notary block.`;

  return prompt;
}
