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
4a. If contingent beneficiaries are provided, add a CONTINGENT BENEFICIARIES article after the residuary clause: "If [primary beneficiary] does not survive me by thirty (30) days, I give my entire residuary estate to [contingent beneficiary names] in equal shares. If any contingent beneficiary shall predecease me, their share shall pass to the surviving contingent beneficiaries in equal shares." If no contingent beneficiaries are provided, use Michigan intestate succession as the fallback.
5. Executor appointment with successor executor, granting full powers to manage, sell, lease, or otherwise handle estate property without court supervision where permitted by Michigan law.
6. Guardian appointment for minor children if applicable, with successor guardian.
7. No-contest clause: Any beneficiary who contests this Will shall forfeit their share, which shall be distributed among the remaining beneficiaries proportionally.
8. Executor powers: The executor shall have full authority under the Michigan Estates and Protected Individuals Code (EPIC), MCL 700.3715, including but not limited to the power to sell, lease, mortgage, or otherwise deal with estate property, pay debts and expenses, distribute assets in kind or in cash, employ professionals, and compromise claims.
9. Digital Assets article: "I authorize my Executor to access, manage, distribute, copy, delete, or terminate any digital asset, digital account, or electronically stored information owned by me, including but not limited to email accounts, social media accounts, financial accounts accessed online, cryptocurrency and digital currency, domain names, and any other digital property. This authority is granted pursuant to the Revised Uniform Fiduciary Access to Digital Assets Act as adopted in Michigan."
10. Governing law clause: This Will shall be governed by and construed in accordance with the laws of the State of Michigan.
11. Severability clause: If any provision of this Will is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
12. Attestation clause for witnesses affirming the testator signed willingly and appeared of sound mind.
13. If guardian information is provided, include a Guardian Designation article: "If my spouse does not survive me, I nominate [Guardian Name] as guardian of the person and estate of my minor children. If [Guardian Name] is unable or unwilling to serve, I nominate [Successor Guardian] as successor guardian. I request that no bond be required of any guardian named herein."
14. Execution Instructions article (ALWAYS include at the end before the signature block). Use this EXACT text verbatim:

"EXECUTION INSTRUCTIONS

To make this Will legally valid under Michigan law (MCL 700.2502), you must follow each step below carefully. Failure to follow these steps may render this Will invalid.

STEP 1 - CHOOSE YOUR WITNESSES
Select two (2) adult witnesses (age 18 or older). Your witnesses must NOT be named beneficiaries in this Will. Your witnesses must be present at the same time as each other and as you when signing.

STEP 2 - GATHER ALL PARTIES
Arrange for yourself and both witnesses to be in the same location at the same time. All three parties must be physically present together throughout the signing.

STEP 3 - YOU SIGN FIRST
Sign and date this Will in the presence of both witnesses simultaneously. Do not sign before both witnesses are present. Sign on the signature line designated for the Testator.

STEP 4 - WITNESSES SIGN
Immediately after you sign, each witness must sign the Will in your presence and in the presence of each other. Each witness should print their name and provide their address on the lines provided.

STEP 5 - NOTARY (OPTIONAL BUT STRONGLY RECOMMENDED)
Although a notary is not required for the Will itself, signing before a licensed notary public completes the self-proving affidavit at the end of this document. A self-proving Will can be admitted to probate without requiring your witnesses to testify in court. All three parties (you and both witnesses) should sign before the notary at the same time.

STEP 6 - STORE YOUR WILL SAFELY
Keep the original signed Will in a secure location such as a fireproof safe, safe deposit box, or with your estate planning attorney. Inform your Executor of its location. Do not store your Will in a location your Executor cannot access without a court order.

STEP 7 - INFORM YOUR EXECUTOR
Provide your Executor with a copy of this Will and confirm they are willing to serve in that role. Keep their contact information current."

NOTARY RULES:
- Do NOT include any county name (such as "Wayne County," "Oakland County," etc.) anywhere in the document body, notary acknowledgment, or witness sections. Leave county fields blank.
- Do NOT write out full notary acknowledgment language, use [NOTARY BLOCK] placeholder only.

OUTPUT FORMAT:
- Return PLAIN TEXT only. Do NOT use any markdown formatting. No pound signs (#), no asterisks (**), no dashes for rules (---), no backticks. Use ALL CAPS for section headers and article titles.
- Use numbered articles (ARTICLE I, ARTICLE II, etc.) for major sections.
- Use [SIGNATURE LINE] where the testator signs.
- Use [DATE LINE] where the date of signing goes.
- For witness blocks use EXACTLY: [WITNESS SIGNATURE] on its own line. Include two witness blocks. Do not add additional labels or headers around witness blocks.
- Use [NOTARY BLOCK] EXACTLY ONCE at the end of the document for the self-proving affidavit. Do NOT write out notary acknowledgment language in the document body, the platform renders this automatically.
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete will text ready for formatting.`;

export function buildWillPrompt(intake: Record<string, unknown>): string {
  // Map camelCase intake fields to template fields
  const i = intake;
  const full_name = (i.full_name || `${i.firstName || ""} ${i.lastName || ""}`.trim()) as string;
  const date_of_birth = (i.date_of_birth || i.dateOfBirth || "") as string;
  const city = (i.city || "") as string;
  const executor_name = (i.executor_name || i.executorName || "") as string;
  const executor_relationship = (i.executor_relationship || i.executorRelationship || "") as string;
  const successor_executor = (i.successor_executor || i.successorExecutorName || "") as string;
  const primary_beneficiary = (i.primary_beneficiary || i.primaryBeneficiaryName || "") as string;
  const primary_beneficiary_relationship = (i.primary_beneficiary_relationship || i.primaryBeneficiaryRelationship || "") as string;
  const secondary_beneficiary = (i.secondary_beneficiary || i.secondBeneficiaryName || "") as string;
  const estate_split = (i.estate_split || i.estateSplit || "100% to primary beneficiary") as string;
  const guardian_name = (i.guardian_name || i.guardianName || "") as string;
  const guardian_relationship = (i.guardian_relationship || i.guardianRelationship || "") as string;
  const successor_guardian = (i.successor_guardian || i.successorGuardianName || "") as string;
  const specific_gifts = (i.specific_gifts || (i.hasSpecificGifts === "Yes" ? i.specificGiftsDescription : "") || "") as string;
  const contingent_beneficiaries = (i.contingent_beneficiaries || i.contingentBeneficiaries || []) as Array<{ name: string; relationship: string; share?: string }>;
  const contingent_equal_shares = (i.contingentEqualShares ?? "Yes") as string;

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
    if (estate_split === "50/50") {
      prompt += `\n- Estate Distribution: Equal split, ${primary_beneficiary} 50%, ${secondary_beneficiary} 50%`;
    } else {
      const customSplitStr = (i.customSplit || i.custom_split || "") as string;
      const sp = customSplitStr.split("/");
      const pPct = sp[0]?.trim();
      const sPct = sp[1]?.trim();
      prompt += pPct && sPct
        ? `\n- Estate Distribution: ${primary_beneficiary} receives ${pPct}%, ${secondary_beneficiary} receives ${sPct}%`
        : `\n- Estate Distribution: ${estate_split}`;
    }
    prompt += `\n\nRESIDUARY CLAUSE INSTRUCTIONS:
If the primary beneficiary does not survive the testator by thirty (30) days, the entire residuary estate shall pass to the secondary beneficiary, ${secondary_beneficiary}. If neither the primary nor secondary beneficiary survives the testator by thirty (30) days, then the estate shall pass to the testator's heirs at law under Michigan intestate succession.`;
  } else {
    prompt += `\n- Estate Distribution: 100% to primary beneficiary`;
    prompt += `\n\nRESIDUARY CLAUSE INSTRUCTIONS:
If the primary beneficiary does not survive the testator by thirty (30) days, the entire residuary estate shall pass to the testator's heirs at law as determined under the laws of intestate succession of the State of Michigan.`;
  }

  if (contingent_beneficiaries.length > 0) {
    prompt += `\n\nCONTINGENT BENEFICIARIES:`;
    contingent_beneficiaries.forEach((b, idx) => {
      const shareLabel = contingent_equal_shares === "No" && b.share ? `, ${b.share}%` : "";
      prompt += `\nContingent Beneficiary ${idx + 1}: ${b.name} (${b.relationship})${shareLabel}`;
    });
    if (contingent_equal_shares === "No") {
      prompt += `\n\nContingent beneficiaries inherit only if ALL primary beneficiaries predecease the testator or fail to survive by 30 days. Distribute the estate among the contingent beneficiaries at the percentages specified above. If any contingent beneficiary predeceases the testator, their share passes to the surviving contingent beneficiaries proportionally.`;
    } else {
      prompt += `\n\nContingent beneficiaries inherit only if ALL primary beneficiaries predecease the testator or fail to survive by 30 days. If multiple contingent beneficiaries, they share equally. If any contingent beneficiary predeceases the testator, their share passes to the surviving contingent beneficiaries in equal shares.`;
    }
  } else {
    prompt += `\n\nCONTINGENT BENEFICIARIES: None designated. If primary beneficiary does not survive, estate passes to heirs under Michigan intestate succession.`;
  }

  if (guardian_name) {
    prompt += `\n\nGUARDIAN APPOINTMENT (for minor children):
- Primary Guardian: ${guardian_name}${guardian_relationship ? ` (${guardian_relationship})` : ''}
- Successor Guardian: ${successor_guardian ?? 'Not specified'}`;
  }

  if (specific_gifts && typeof specific_gifts === "string" && specific_gifts.trim()) {
    prompt += `\n\nSPECIFIC GIFTS:\n${specific_gifts}`;
  }

  prompt += `\n\nGenerate the complete Last Will and Testament document text now. Include all required articles, signature blocks, witness attestation, and self-proving affidavit with notary block.`;

  return prompt;
}
