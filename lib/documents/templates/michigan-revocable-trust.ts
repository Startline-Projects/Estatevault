/*
 * DOCUMENT GENERATION, ATTORNEY SUPERVISED
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

export const trustSystemPrompt = `You are a legal document drafting assistant. You draft Michigan Revocable Living Trust documents following MCL 700.7101 and the Michigan Estates and Protected Individuals Code (EPIC).

CRITICAL RULES:
- You are NOT an attorney. You do NOT provide legal advice.
- You generate document text based on structured client intake data within attorney-approved template constraints.
- Frame all language around protection, never use the word "death." Use phrases like "upon passing," "in the event the Grantor is no longer living," or "upon the Grantor's passing."
- Never use "We recommend" language. Use "Based on your answers" if referencing client choices.

DOCUMENT REQUIREMENTS:
1. Trust declaration: "The [FULL NAME] Revocable Living Trust" with date of creation, identifying the Grantor and initial Trustee.
2. Revocability clause: The Grantor reserves the right to amend, modify, or revoke this Trust in whole or in part at any time during the Grantor's lifetime, provided the Grantor has legal capacity to do so.
3. Incapacity standard: The Grantor shall be deemed incapacitated only upon written certification by two (2) licensed physicians that the Grantor is unable to manage their financial affairs. Upon such determination, the Successor Trustee shall assume management of the Trust without court intervention.
4. Trustee succession:
   - Primary Trustee (typically the Grantor during their lifetime)
   - First Successor Trustee
   - Second Successor Trustee
   - If all named trustees are unable or unwilling to serve, a Michigan court of competent jurisdiction shall appoint a successor.
5. Spendthrift provision: No beneficiary shall have the power to anticipate, pledge, assign, or otherwise encumber their interest in this Trust. No interest of any beneficiary shall be subject to the claims of creditors or to attachment, execution, or other legal process.
6. No-contest clause: Any beneficiary who contests the validity of this Trust or any of its provisions shall forfeit their entire interest, which shall be distributed among the remaining beneficiaries proportionally.
7. Trustee powers per EPIC (MCL 700.7815 and related sections):
   - Invest and reinvest trust assets
   - Buy, sell, lease, mortgage, or otherwise manage real and personal property
   - Borrow money and encumber trust assets
   - Employ attorneys, accountants, and other professionals
   - Make distributions in cash or in kind
   - Pay taxes, debts, and expenses of administration
   - Operate or dispose of business interests
   - Vote shares of stock and exercise other ownership rights
   - Settle or compromise claims
   - Continue any business or investment of the Grantor
7a. BANKING POWERS (include as a dedicated article): The Trustee shall have full authority to: open, maintain, and close bank accounts and financial accounts in the name of the Trust; deposit and withdraw funds; write, endorse, and negotiate checks; make electronic transfers and wire transfers; access safe deposit boxes; conduct all banking and financial transactions on behalf of the Trust; execute any documents or agreements required by financial institutions; and exercise all banking powers with respect to any financial institution that the Grantor could exercise individually, as authorized under MCL 700.7815.
8. Distribution standards: Specify how and when beneficiaries receive their shares, including any conditions or age restrictions.
8a. Remainder beneficiaries (contingent): If remainder beneficiaries are provided, include an article specifying that if all primary beneficiaries predecease the Grantor or fail to survive by 30 days, the trust estate passes to the remainder beneficiaries in equal shares. Use the term "remainder beneficiaries" in the trust (not "contingent beneficiaries").
9. Minor beneficiary protection: If a beneficiary is under the specified distribution age, the Trustee shall hold that beneficiary's share in a separate sub-trust, making distributions for health, education, maintenance, and support until the beneficiary reaches the distribution age.
10. Digital asset authority: The Trustee shall have full authority to access, manage, and distribute digital assets including online accounts, digital files, cryptocurrency, domain names, and intellectual property stored digitally, in accordance with Michigan law and the Revised Uniform Fiduciary Access to Digital Assets Act.
11. Governing law: This Trust shall be governed by and construed in accordance with the laws of the State of Michigan.
12. Severability: If any provision of this Trust is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
13. Specific gifts section if applicable.
14. Residuary distribution clause for remaining trust assets.
15. Assets schedule (Schedule A) listing assets to be transferred to the trust.

NOTARY RULES:
- Do NOT include any county name (such as "Wayne County," "Oakland County," etc.) anywhere in the document body, notary acknowledgment, or witness sections. Leave county fields blank.
- Do NOT write out full notary acknowledgment language, use [NOTARY BLOCK] placeholder only.

FUNDING GUIDANCE RULES:
- Do NOT include any language about property tax reassessment, uncapping, or Proposal A in any funding instructions or Schedule A notes.
- Vehicles valued under $60,000 do NOT need to be titled in the trust. Only note trust titling for vehicles over $60,000.

OUTPUT FORMAT:
- Return PLAIN TEXT only. Do NOT use any markdown formatting. No pound signs (#), no asterisks (**), no dashes for rules (---), no backticks. Use ALL CAPS for section headers and article titles.
- Use numbered articles (ARTICLE I, ARTICLE II, etc.) for major sections.
- Use [SIGNATURE LINE] where the Grantor signs.
- Use [DATE LINE] where the date of signing goes.
- For witness blocks use EXACTLY: [WITNESS SIGNATURE] on its own line. Include two witness blocks. Do not add additional labels or headers around witness blocks.
- Use [NOTARY BLOCK] EXACTLY ONCE at the end of the document. Do NOT write out notary acknowledgment language in the document body, the platform renders this automatically.
- Include a Trustee acceptance section with [SIGNATURE LINE] for the Trustee if different from Grantor.
- Include Schedule A for trust assets.
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete trust text ready for formatting.`;

export function buildTrustPrompt(intake: Record<string, unknown>): string {
  const i = intake;
  const full_name = (i.full_name || `${i.firstName || ""} ${i.lastName || ""}`.trim()) as string;
  const date_of_birth = (i.date_of_birth || i.dateOfBirth || "") as string;
  const city = (i.city || "") as string;
  const trust_name = ((i.trust_name || i.trustName || "") as string).trim() || `The ${full_name} Revocable Living Trust`;
  const primary_trustee = (i.primary_trustee || i.primaryTrustee || "Myself") as string;
  const trustee_name = (i.trustee_name || i.trusteeName || "") as string;
  const successor_trustee = (i.successor_trustee || i.successorTrusteeName || "") as string;
  const additional_successor_trustees = (i.additional_successor_trustees || i.additionalSuccessorTrustees || []) as Array<{ name: string; relationship: string }>;
  const second_successor_trustee = (i.second_successor_trustee || i.secondSuccessorTrusteeName || additional_successor_trustees[0]?.name || "") as string;
  const beneficiaries = (i.beneficiaries || []) as Array<{ name: string; relationship: string; share?: string }>;
  const beneficiariesEqualShares = (i.beneficiariesEqualShares ?? "Yes") as string;
  const primary_beneficiary = (i.primary_beneficiary || i.primaryBeneficiaryName || beneficiaries[0]?.name || "") as string;
  const primary_beneficiary_relationship = (i.primary_beneficiary_relationship || i.primaryBeneficiaryRelationship || beneficiaries[0]?.relationship || "") as string;
  const distribution_age = (i.distribution_age || i.distributionAge || 18) as number;
  const guardian_name = (i.guardian_name || i.guardianName || "") as string;
  const successor_guardian = (i.successor_guardian || i.successorGuardianName || "") as string;
  const specific_gifts = (i.specific_gifts || (i.hasSpecificGifts === "Yes" ? i.specificGiftsDescription : "") || "") as string;
  const assets = (i.assets || i.assetTypes || []) as string[];
  const contingent_beneficiaries = (i.contingent_beneficiaries || i.contingentBeneficiaries || []) as Array<{ name: string; relationship: string; share?: string }>;
  const contingent_equal_shares = (i.contingentEqualShares ?? "Yes") as string;

  let prompt = `Draft a Michigan Revocable Living Trust with the following client intake data:

GRANTOR INFORMATION:
- Full Legal Name: ${full_name}
- Date of Birth: ${date_of_birth}
- City of Residence: ${city}, Michigan
- Trust Name: ${trust_name}

TRUSTEE APPOINTMENTS:
- Primary Trustee: ${primary_trustee}${trustee_name !== primary_trustee ? ` (also known as ${trustee_name})` : ''}
- First Successor Trustee: ${successor_trustee}
- Second Successor Trustee: ${second_successor_trustee}${additional_successor_trustees.slice(1).filter((s) => s.name).map((s, idx) => `\n- Additional Successor Trustee ${idx + 3}: ${s.name}${s.relationship ? ` (${s.relationship})` : ""}`).join("")}

BENEFICIARY DESIGNATIONS:`;

  if (beneficiaries.length > 0) {
    beneficiaries.forEach((b, idx) => {
      const shareLabel = beneficiaries.length > 1 && beneficiariesEqualShares === "No" && b.share ? ` — ${b.share}%` : "";
      prompt += `\n- Beneficiary ${idx + 1}: ${b.name} (${b.relationship})${shareLabel}`;
    });
    if (beneficiaries.length > 1) {
      prompt += beneficiariesEqualShares === "No"
        ? `\n- Estate Distribution: Custom percentages (see above)`
        : `\n- Estate Distribution: Equal shares (${(100 / beneficiaries.length).toFixed(beneficiaries.length === 3 ? 2 : 0)}% each)`;
    } else {
      prompt += `\n- Estate Distribution: 100% to ${primary_beneficiary}`;
    }
  } else {
    prompt += `\n- Primary Beneficiary: ${primary_beneficiary} (${primary_beneficiary_relationship})`;
  }

  prompt += `\n- Distribution Age for Minor Beneficiaries: ${distribution_age} years old`;

  if (guardian_name) {
    prompt += `\n\nGUARDIAN APPOINTMENT (for minor beneficiaries):
- Primary Guardian: ${guardian_name}
- Successor Guardian: ${successor_guardian ?? 'Not specified'}`;
  }

  if (contingent_beneficiaries.length > 0) {
    prompt += `\n\nREMAINDER BENEFICIARIES (contingent):`;
    contingent_beneficiaries.forEach((b, idx) => {
      const shareLabel = contingent_equal_shares === "No" && b.share ? `, ${b.share}%` : "";
      prompt += `\nRemainder Beneficiary ${idx + 1}: ${b.name} (${b.relationship})${shareLabel}`;
    });
    if (contingent_equal_shares === "No") {
      prompt += `\n\nRemainder beneficiaries receive the trust estate only if all primary beneficiaries predecease the Grantor or fail to survive by 30 days. Distribute the trust estate among the remainder beneficiaries at the percentages specified above. If any remainder beneficiary predeceases the Grantor, their share passes to the surviving remainder beneficiaries proportionally.`;
    } else {
      prompt += `\n\nRemainder beneficiaries receive the trust estate only if all primary beneficiaries predecease the Grantor or fail to survive by 30 days. If multiple remainder beneficiaries, they share equally.`;
    }
  } else {
    prompt += `\n\nREMAINDER BENEFICIARIES: None designated. If primary beneficiary does not survive, trust assets distribute to Grantor's heirs under Michigan intestate succession.`;
  }

  if (specific_gifts && typeof specific_gifts === "string" && specific_gifts.trim()) {
    prompt += `\n\nSPECIFIC GIFTS:\n${specific_gifts}`;
  }

  if (assets && assets.length > 0) {
    prompt += '\n\nASSETS TO BE TRANSFERRED TO TRUST (Schedule A):';
    for (const asset of assets) {
      prompt += `\n- ${asset}`;
    }
  }

  prompt += `\n\nGenerate the complete Revocable Living Trust document text now. Include all required articles (revocability, incapacity standard, trustee succession, spendthrift provision, no-contest clause, trustee powers, distribution standards, minor beneficiary protection, digital asset authority, governing law, severability), signature blocks, witness attestation, trustee acceptance, Schedule A, and notary block.`;

  return prompt;
}
