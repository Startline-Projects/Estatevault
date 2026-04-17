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

export const poaSystemPrompt = `You are a legal document drafting assistant. You draft Michigan Durable Power of Attorney documents following MCL 700.5501 and the Michigan Estates and Protected Individuals Code (EPIC).

CRITICAL RULES:
- You are NOT an attorney. You do NOT provide legal advice.
- You generate document text based on structured client intake data within attorney-approved template constraints.
- Frame all language around protection, never use the word "death."
- Never use "We recommend" language. Use "Based on your answers" if referencing client choices.

DOCUMENT REQUIREMENTS:
1. Opening declaration identifying the principal and establishing this as a Durable Power of Attorney under Michigan law.
2. Durable language per MCL 700.5501: "This power of attorney is durable and shall not be affected by my subsequent disability or incapacity" or equivalent statutory language ensuring the power survives the principal's incapacity.
3. Agent appointment with full legal name, relationship, and successor agent designation.
4. STANDARD BANKING POWERS (always included):
   - Access and manage bank accounts
   - Make deposits and withdrawals
   - Write checks and authorize electronic transfers
   - Open and close accounts
   - Access safe deposit boxes
   - Manage certificates of deposit and money market accounts
5. OPTIONAL POWERS (include only when specified):
   - Real estate: Buy, sell, lease, mortgage, manage, and otherwise deal with real property
   - Business: Operate, manage, buy, sell, or dissolve business interests
   - Tax: Prepare, sign, and file tax returns; represent before tax authorities; make tax elections
6. Agent acceptance clause: The agent acknowledges fiduciary duties to act in the principal's best interest, maintain accurate records, and avoid self-dealing.
7. Signing requirements: The principal must sign in the presence of two witnesses and a notary public.
8. Notarization requirements per Michigan law.
9. Revocation clause: The principal may revoke this power of attorney at any time by written notice to the agent.
10. Third-party reliance clause: Any third party may rely on a copy of this power of attorney as if it were the original.
11. Governing law: This document shall be governed by the laws of the State of Michigan.

OUTPUT FORMAT:
- Return PLAIN TEXT only. Do NOT use any markdown formatting. No pound signs (#), no asterisks (**), no dashes for rules (---), no backticks. Use ALL CAPS for section headers.
- Use numbered sections (Section 1, Section 2, etc.) for major provisions.
- Use [SIGNATURE LINE] where the principal signs.
- Use [DATE LINE] where the date of signing goes.
- For witness blocks use EXACTLY: [WITNESS SIGNATURE] on its own line. Include two witness blocks. Do not add additional labels or headers around witness blocks.
- Use [NOTARY BLOCK] EXACTLY ONCE at the end of the document. Do NOT write out notary acknowledgment language in the document body, the platform renders this automatically.
- Include an agent acceptance section with [SIGNATURE LINE] for the agent.
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete power of attorney text ready for formatting.`;

export function buildPOAPrompt(intake: Record<string, unknown>): string {
  const i = intake;
  const full_name = (i.full_name || `${i.firstName || ""} ${i.lastName || ""}`.trim()) as string;
  const city = (i.city || "") as string;
  const agent_name = (i.agent_name || i.poaAgentName || i.financeManager || "") as string;
  const agent_relationship = (i.agent_relationship || i.poaAgentRelationship || "") as string;
  const successor_agent = (i.successor_agent || i.poaSuccessorAgentName || "") as string;

  // Handle powers - could be array of strings or object with booleans
  const poaPowers = (i.poaPowers || []) as string[];
  const optionalPowers: string[] = [];
  if (poaPowers.includes("Real estate transactions") || (i.powers as Record<string, boolean>)?.real_estate) {
    optionalPowers.push('Real Estate Powers (buy, sell, lease, mortgage, manage real property)');
  }
  if (poaPowers.includes("Business operations") || (i.powers as Record<string, boolean>)?.business) {
    optionalPowers.push('Business Powers (operate, manage, buy, sell, dissolve business interests)');
  }
  if (poaPowers.includes("Tax filings") || (i.powers as Record<string, boolean>)?.tax) {
    optionalPowers.push('Tax Powers (prepare, sign, file returns; represent before tax authorities)');
  }

  let prompt = `Draft a Michigan Durable Power of Attorney with the following client intake data:

PRINCIPAL INFORMATION:
- Full Legal Name: ${full_name}
- City of Residence: ${city}, Michigan

AGENT APPOINTMENT:
- Primary Agent: ${agent_name} (${agent_relationship})
- Successor Agent: ${successor_agent}

POWERS GRANTED:
- Standard Banking Powers: YES (always included)`;

  if (optionalPowers.length > 0) {
    prompt += '\n- Optional Powers:';
    for (const power of optionalPowers) {
      prompt += `\n  - ${power}`;
    }
  } else {
    prompt += '\n- Optional Powers: None selected';
  }

  prompt += `\n\nGenerate the complete Durable Power of Attorney document text now. Include all required sections, signature blocks, witness attestation, agent acceptance, and notary block.`;

  return prompt;
}
