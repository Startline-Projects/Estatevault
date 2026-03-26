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
- Use formal legal language appropriate for a Michigan Durable Power of Attorney.
- Use numbered sections (Section 1, Section 2, etc.) for major provisions.
- Use [SIGNATURE LINE] where the principal signs.
- Use [DATE LINE] where the date of signing goes.
- Use [WITNESS SIGNATURE] where each witness signs (include two witness blocks).
- Use [NOTARY BLOCK] where notary acknowledgment goes.
- Include an agent acceptance section with [SIGNATURE LINE] for the agent.
- Do NOT include any commentary, instructions, or explanations outside the document text itself.
- Output ONLY the complete power of attorney text ready for formatting.`;

export function buildPOAPrompt(intake: Record<string, unknown>): string {
  const {
    full_name,
    city,
    agent_name,
    agent_relationship,
    successor_agent,
    powers,
  } = intake as {
    full_name: string;
    city: string;
    agent_name: string;
    agent_relationship: string;
    successor_agent: string;
    powers: {
      real_estate: boolean;
      business: boolean;
      tax: boolean;
    };
  };

  const optionalPowers: string[] = [];
  if (powers.real_estate) {
    optionalPowers.push('Real Estate Powers (buy, sell, lease, mortgage, manage real property)');
  }
  if (powers.business) {
    optionalPowers.push('Business Powers (operate, manage, buy, sell, dissolve business interests)');
  }
  if (powers.tax) {
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
