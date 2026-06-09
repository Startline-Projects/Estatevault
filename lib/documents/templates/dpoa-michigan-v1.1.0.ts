const template = `
DURABLE POWER

OF ATTORNEY

FINANCIAL AUTHORITY

OF

{{client_full_name_upper}}

Principal: {{client_full_name}}  ·  Date of Birth: {{client_dob}}

Residence: {{street_address}}, {{city}}, {{county}} County, Michigan  {{zip}}

Primary Agent: {{dpoa_agent.full_name}}  ·  {{dpoa_agent.relationship}}

First Successor Agent: {{first_successor_dpoa_agent.full_name}}  ·  {{first_successor_dpoa_agent.relationship}}

Second Successor Agent: {{second_successor_dpoa_agent.full_name}}  ·  {{second_successor_dpoa_agent.relationship}}

## OPERATION OF THIS DOCUMENT

This is your Durable Power of Attorney under the Michigan Uniform Power of Attorney Act (MCL 556.201 et seq., effective July 1, 2024). It authorizes the person you name (your Agent) to handle your financial matters. "Durable" means it remains effective if you later become incapacitated. It does NOT authorize medical decisions, which are governed by a separate Patient Advocate Designation under MCL 700.5506. This document terminates automatically upon your death.

State of Michigan  ·  Michigan Uniform Power of Attorney Act, MCL 556.201 et seq.

Michigan Uniform Fiduciary Access to Digital Assets Act, MCL 700.1003 et seq.

{{#IF attorney_review_purchased}}

## ATTORNEY REVIEWED & APPROVED

Reviewing Attorney: {{reviewing_attorney_name}}  ·  Bar No. {{reviewing_attorney_bar_number}}

Firm: {{reviewing_attorney_firm}}  ·  Reviewed: {{review_date}}

{{/IF}}

## IMPORTANT INFORMATION FOR THE PRINCIPAL

By signing this document, you authorize another person (the Agent) to make decisions about your money, property, and other financial matters. This authority can be very broad. Read this document carefully before signing. The Agent is required by law to act in your best interest, in good faith, and in accordance with your reasonable expectations. The Agent must keep your property separate from the Agent's own property and must keep records of all transactions made on your behalf. You may revoke this document at any time, as long as you are mentally competent, by signing a written revocation, by physically destroying this document with the intent to revoke it, or by executing a new power of attorney that revokes this one.

## ARTICLE I — DESIGNATION OF AGENT AND SUCCESSOR AGENTS

### Section 1.1 — Designation of Principal.

I, {{client_full_name}}, a resident of {{city}}, {{county}} County, Michigan, with a residence address of {{street_address}}, {{city}}, Michigan {{zip}} (the "Principal"), do hereby make this Durable Power of Attorney under the Michigan Uniform Power of Attorney Act, MCL 556.201 et seq.

### Section 1.2 — Designation of Agent.

I designate {{dpoa_agent.full_name}}, currently residing in {{dpoa_agent.city}}, {{dpoa_agent.state}}, with a contact telephone number of {{dpoa_agent.phone}} (the "Agent"), as my Agent to act on my behalf under this Durable Power of Attorney. The Agent is my {{dpoa_agent.relationship}}.

### Section 1.3 — Designation of First Successor Agent.

If {{dpoa_agent.full_name}} is unable or unwilling to serve as my Agent, dies, resigns, becomes incapacitated, or for any other reason ceases to serve, I designate {{first_successor_dpoa_agent.full_name}}, currently residing in {{first_successor_dpoa_agent.city}}, {{first_successor_dpoa_agent.state}}, with a contact telephone number of {{first_successor_dpoa_agent.phone}}, as my First Successor Agent. The First Successor Agent is my {{first_successor_dpoa_agent.relationship}}.

### Section 1.4 — Designation of Second Successor Agent.

If both {{dpoa_agent.full_name}} and {{first_successor_dpoa_agent.full_name}} are unable or unwilling to serve, die, resign, become incapacitated, or for any other reason cease to serve, I designate {{second_successor_dpoa_agent.full_name}}, currently residing in {{second_successor_dpoa_agent.city}}, {{second_successor_dpoa_agent.state}}, with a contact telephone number of {{second_successor_dpoa_agent.phone}}, as my Second Successor Agent. The Second Successor Agent is my {{second_successor_dpoa_agent.relationship}}.

### Section 1.5 — Authority of Successor Agents.

Each Successor Agent shall have all of the same powers and authority granted to the Agent under this Durable Power of Attorney. References in this document to "the Agent" shall include any Successor Agent duly serving in that capacity.

### Section 1.6 — Coagency.

I do not designate co-agents. Only one Agent shall serve at any given time. The order of priority is set forth in Sections 1.2, 1.3, and 1.4.

## ARTICLE II — DURABILITY

### Section 2.1 — Statutory Durability Language.

Pursuant to the Michigan Uniform Power of Attorney Act, MCL 556.201 et seq., this is a Durable Power of Attorney. The authority granted to my Agent shall not be affected by my subsequent incapacity, disability, or lapse of time, and shall continue in full force and effect until terminated as provided in this document or by Michigan law.

### Section 2.2 — Survival of Authority.

The Agent's authority shall not terminate upon any of the following: my subsequent disability or incapacity, however caused; the lapse of time since execution of this document; or any uncertainty as to whether I am alive or have died, provided that the Agent acts in good faith without actual knowledge of my death.

## ARTICLE III — EFFECTIVE DATE

{{#IF dpoa_effective equals "immediate"}}

### Section 3.1 — Effective Immediately.

This Durable Power of Attorney is effective immediately upon execution. The Agent may exercise the powers granted in this document immediately, regardless of whether I am incapacitated or have any other limitation on my ability to act on my own behalf.

### Section 3.2 — Continued Effectiveness.

Although this Durable Power of Attorney is effective immediately, I retain full authority over my own affairs as long as I am competent to act. I may, at any time while I am competent, instruct the Agent regarding the exercise of any power granted under this document, and the Agent shall follow my instructions.

{{/IF}}

{{#IF dpoa_effective equals "springing"}}

### Section 3.1 — Springing Effectiveness.

This Durable Power of Attorney is a "springing" power of attorney. The Agent's authority under this document shall not become effective until a physician licensed to practice medicine in the United States has examined me and certified in writing that I am unable to manage my own financial affairs by reason of mental or physical incapacity.

### Section 3.2 — Certification of Incapacity.

The physician's certification shall be in the form of a signed, dated written statement that includes the physician's full name, address, and professional license number; a statement that the physician has examined me; the physician's professional opinion that I am unable to manage my own financial affairs by reason of mental or physical incapacity; and the physician's signature. A copy of the physician's written certification shall be attached to this Durable Power of Attorney before the Agent exercises any authority under it. The Agent may rely on the physician's written certification in good faith.

### Section 3.3 — Restoration of Capacity.

If I subsequently regain capacity, the Agent's authority under this document shall be suspended for the duration of my restored capacity. The Agent's authority shall again become effective upon a new physician's certification of incapacity made after the period of restored capacity.

{{/IF}}

## ARTICLE IV — POWERS GRANTED TO THE AGENT

### Section 4.1 — General Grant of Authority.

I grant to my Agent the powers set forth in this Article IV. The Agent shall exercise these powers in my best interest, in good faith, and in accordance with my reasonable expectations to the extent actually known by the Agent and, otherwise, in my best interest. Each power below is GRANTED or NOT GRANTED based on my selections, and a power that is NOT GRANTED may not be exercised by the Agent under any circumstances absent my separate written authorization.

### Section 4.2 — Specific Powers Granted to the Agent.

{{#IF dpoa_powers contains "banking"}}

■  Banking and Financial Institution Transactions.  GRANTED.

The Agent is authorized to access and manage my bank accounts, savings accounts, certificates of deposit, money market accounts, and all other accounts held at financial institutions; to make deposits and withdrawals; to write checks and authorize transfers; to open and close accounts in my name; to access safe deposit boxes; to endorse and negotiate checks, drafts, and other instruments payable to me; and to take any other action with respect to my financial institution accounts as the Agent deems appropriate in my best interest.

{{/IF}}

{{#IF dpoa_powers contains "real_estate"}}

■  Real Estate Transactions.  GRANTED.

The Agent is authorized to buy, sell, lease, mortgage, encumber, manage, maintain, repair, improve, or otherwise deal with any real property in which I have an interest; to execute deeds, mortgages, leases, contracts for sale or purchase, and other instruments affecting real property; to engage in real estate transactions on my behalf; and to take any action necessary or convenient to manage my real property interests.

{{/IF}}

{{#IF dpoa_powers contains "business"}}

■  Business Interests.  GRANTED.

The Agent is authorized to operate, manage, buy, sell, or dissolve any business interest in which I have an ownership stake; to act as my proxy in any business decision requiring my vote or consent; to enter into and execute business contracts, partnership agreements, and operating agreements on my behalf; and to take any action necessary or convenient with respect to my business interests.

{{/IF}}

{{#IF dpoa_powers contains "tax"}}

■  Tax Matters.  GRANTED.

The Agent is authorized to prepare, sign, and file federal, state, and local tax returns of any kind on my behalf; to represent me before the Internal Revenue Service, the Michigan Department of Treasury, and any other tax authority; to make tax elections and other tax-related decisions; to receive confidential tax information; to pay or contest any tax assessment; and to execute IRS Form 2848 and similar documents required by tax authorities.

{{/IF}}

{{#IF dpoa_powers contains "insurance"}}

■  Insurance.  GRANTED.

The Agent is authorized to apply for, manage, modify, cancel, surrender, or change beneficiary designations on any insurance policy of which I am the owner (excluding life insurance beneficiary designations, which the Agent may not change unless specifically authorized); to file insurance claims on my behalf; to receive insurance proceeds; and to take any other action with respect to insurance as the Agent deems appropriate in my best interest.

{{/IF}}

{{#IF dpoa_powers contains "government_benefits"}}

■  Government Benefits.  GRANTED.

The Agent is authorized to apply for and manage Social Security benefits, Medicare benefits, Medicaid benefits, Veterans Affairs benefits, unemployment benefits, and any other federal, state, or local government benefit programs on my behalf; to receive payments under any such program; to appeal adverse decisions; and to be designated as my Representative Payee by the Social Security Administration.

{{/IF}}

{{#IF dpoa_powers contains "retirement"}}

■  Retirement Accounts.  GRANTED.

The Agent is authorized to manage any retirement account in which I have an interest, including 401(k) plans, 403(b) plans, traditional and Roth Individual Retirement Accounts, pension plans, and other tax-qualified retirement vehicles; to make investment elections and reallocate assets; to elect or change distribution options (subject to plan limitations); and to elect to roll over or transfer assets between accounts. The Agent shall not have authority to change the beneficiary designation on any retirement account unless specifically authorized in writing.

{{/IF}}

{{#IF dpoa_powers contains "digital"}}

■  Digital Assets.  GRANTED.

Pursuant to the Michigan Fiduciary Access to Digital Assets Act (MCL 700.1003 et seq.), the Agent is authorized to access, manage, copy, control, and terminate my digital assets and electronic communications, including email accounts, social media profiles, cloud storage accounts, online financial accounts, cryptocurrency holdings, digital wallets, domain names, and any other electronic records or communications in which I have an interest. The Agent may consent on my behalf to disclosure of the content of my electronic communications under federal and state law.

{{/IF}}

### Section 4.3 — Hot Powers (Specifically Granted or Withheld).

Under the Michigan Uniform Power of Attorney Act, the following two powers are "hot powers" that cannot be inferred from a general grant of authority. Each power is either expressly granted or expressly NOT granted based on my selections.

{{#IF dpoa_powers contains "gift_making"}}

■  Gift-Making Authority.  GRANTED.

I specifically and expressly grant the Agent the authority to make gifts of my property to other persons. This authority includes making gifts that do not exceed the annual federal gift tax exclusion (as adjusted for inflation) per donee per calendar year; making larger gifts where the Agent determines, in the Agent's reasonable judgment, that such gifts are consistent with my prior pattern of gifting, my estate plan, or planning for my long-term care needs; making gifts to qualified charitable organizations consistent with my prior pattern of charitable giving; and making gifts as part of Medicaid planning, gift-tax planning, or estate-tax planning that the Agent determines, in good faith, to be in my best interest. The Agent shall not make gifts that benefit the Agent personally without first obtaining written consent from at least one other adult family member of the Principal who is not a beneficiary of the gift.

{{/IF}}

{{#IF dpoa_powers does_not_contain "gift_making"}}

□  Gift-Making Authority.  NOT GRANTED.

The Agent is NOT authorized to make gifts of my property. Any gift made by the Agent of my property without my express written consent is unauthorized and a breach of the Agent's fiduciary duty.

{{/IF}}

{{#IF dpoa_powers contains "amend_estate_plan"}}

■  Authority to Make Changes to Estate Plan.  GRANTED.

I specifically and expressly grant the Agent the authority to amend, modify, or revoke any trust agreement, beneficiary designation, transfer-on-death designation, or other estate planning instrument that I have executed. This authority shall be exercised only in furtherance of my reasonably understood goals and only when the Agent determines, in good faith, that such amendment, modification, or revocation is necessary or appropriate in my best interest. The Agent shall not exercise this authority to redirect property to the Agent personally, to the Agent's family members, or to any other party in a manner inconsistent with my prior estate plan, unless I have given the Agent specific written instructions to do so.

{{/IF}}

{{#IF dpoa_powers does_not_contain "amend_estate_plan"}}

□  Authority to Make Changes to Estate Plan.  NOT GRANTED.

The Agent is NOT authorized to amend, modify, or revoke any trust agreement, beneficiary designation, transfer-on-death designation, or other estate planning instrument that I have executed. Any attempt by the Agent to do so without my express written consent is unauthorized.

{{/IF}}

### Section 4.4 — Limitations on Agent's Authority.

The Agent shall NOT make or amend a will on my behalf; vote in any public election on my behalf; execute, modify, or revoke a Patient Advocate Designation on my behalf (medical decisions are governed by a separate Patient Advocate Designation); take any action that would be in violation of Michigan or federal law; or take any action that would be a breach of the Agent's fiduciary duties under MCL 556.214.

### Section 4.5 — Incorporation of Statutory Authority.

In addition to the powers expressly granted in this Article IV, the Agent shall have all of the general authority granted to agents under the Michigan Uniform Power of Attorney Act, except where such authority is expressly limited or excluded in this document.

## ARTICLE V — COMPENSATION OF AGENT

### Section 5.1 — Compensation.

{{#IF dpoa_agent_compensation equals "reasonable"}}

The Agent shall be entitled to reasonable compensation for services rendered as Agent under this Durable Power of Attorney. "Reasonable compensation" shall be determined based on the time spent, the complexity of the matters handled, the skill required, and the prevailing rates in the community for similar services. The Agent shall keep records of time spent and services rendered.

{{/IF}}

{{#IF dpoa_agent_compensation equals "none"}}

The Agent shall serve without compensation. The Agent is providing services as a gift to me and my family.

{{/IF}}

{{#IF dpoa_agent_compensation equals "specified"}}

The Agent shall be entitled to compensation for services rendered as Agent under this Durable Power of Attorney in the amount of {{dpoa_agent_compensation_amount}}.

{{/IF}}

### Section 5.2 — Reimbursement of Expenses.

The Agent shall be entitled to reimbursement from my assets for all reasonable out-of-pocket expenses incurred in the performance of the Agent's duties, including travel expenses, postage, professional fees, and document preparation costs.

## ARTICLE VI — AGENT'S DUTIES

### Section 6.1 — Statutory Duties Under Michigan Law.

The Agent's duties are set forth in the Michigan Uniform Power of Attorney Act at MCL 556.214 and are incorporated into this document by reference. These duties include the duty to act loyally for my benefit; the duty to act in good faith; the duty to not create a conflict of interest that impairs the Agent's ability to act impartially in my best interest; the duty to act with the care, competence, and diligence ordinarily exercised by agents in similar circumstances; the duty to keep records of all receipts, disbursements, and transactions made on my behalf; the duty to cooperate with any person who has authority to make health care decisions for me; the duty to attempt to preserve my estate plan, to the extent actually known by the Agent, if preserving the plan is consistent with my best interest; and the duty to keep my property separate from the Agent's own property.

### Section 6.2 — Records and Accounting.

The Agent shall keep contemporaneous records of all receipts, disbursements, and transactions conducted on my behalf, including the source of receipts, the purpose of each disbursement, and the date and amount of each transaction. Upon request by me, a court of competent jurisdiction, my Patient Advocate, my Personal Representative, or any other person with a legitimate interest in my financial affairs, the Agent shall provide a written accounting of all actions taken on my behalf.

### Section 6.3 — Standard of Care.

The Agent shall exercise the powers granted in this document with the care, competence, and diligence ordinarily exercised by agents in similar circumstances. The Agent shall not be liable for actions taken in good faith and in the exercise of reasonable judgment, even if the actions later prove to have been mistaken or imprudent, provided the Agent did not breach any fiduciary duty.

## ARTICLE VII — THIRD-PARTY RELIANCE

### Section 7.1 — Acceptance by Third Parties.

Pursuant to MCL 556.220, any person or institution presented with this Durable Power of Attorney may rely on its authority and is hereby fully released and indemnified from any liability for any action taken in reliance on this document. The Principal expressly directs that this Durable Power of Attorney be accepted by all financial institutions, government agencies, healthcare providers (with respect to financial matters only), insurance companies, and other persons or entities to whom it is presented.

### Section 7.2 — Photocopies.

A photocopy or electronically reproduced copy of this Durable Power of Attorney shall have the same force and effect as the original, except where a third party reasonably requires an original signature for a specific transaction.

### Section 7.3 — Indemnification of Reliant Parties.

I, the Principal, hereby agree to indemnify and hold harmless any person who, in good faith, acts in reliance on this Durable Power of Attorney from any liability arising from such reliance, except in cases of bad faith or actual knowledge that the Durable Power of Attorney has been terminated, suspended, or revoked.

## ARTICLE VIII — TERMINATION

### Section 8.1 — Termination of Power.

This Durable Power of Attorney shall terminate upon any of the following events: my death; my written revocation, properly executed; a court order terminating the power; or the unavailability of any duly-serving Agent or Successor Agent, where no further Successor Agent is designated and available.

### Section 8.2 — Termination of Agent's Authority.

The authority of a particular Agent terminates upon the Agent's death, incapacity, resignation, removal by court order, or upon the occurrence of a condition specified in this document terminating that Agent's authority. Upon such termination, the next available Successor Agent shall assume the role of Agent.

### Section 8.3 — Effect of Marriage Termination on Spouse Agent.

If my spouse is named as Agent in this document and our marriage is terminated by divorce, annulment, or court order, my spouse's designation as Agent is automatically revoked unless this document specifically states otherwise. The next designated Successor Agent shall serve as Agent.

## ARTICLE IX — GENERAL PROVISIONS

### Section 9.1 — Severability.

If any provision of this Durable Power of Attorney is held to be invalid, unenforceable, or contrary to law, the remaining provisions shall continue in full force and effect.

### Section 9.2 — Governing Law.

This Durable Power of Attorney shall be governed by and construed in accordance with the laws of the State of Michigan, including the Michigan Uniform Power of Attorney Act, MCL 556.201 et seq.

### Section 9.3 — Definitions.

"Agent" includes the Agent designated in Section 1.2 and any duly-serving Successor Agent. "Principal" refers to me. "Michigan Uniform Power of Attorney Act" or "UPOAA" refers to MCL 556.201 et seq. as in effect on the date this document is signed, and includes any successor or amending statutes. Words denoting one gender include all genders, and the singular includes the plural.

### Section 9.4 — Headings.

The headings of Articles and Sections are for convenience of reference only and shall not affect the construction of this document.

## ATTESTATION

IN WITNESS WHEREOF, I, {{client_full_name}}, the Principal, sign my name to this Durable Power of Attorney on this _ day of _, 20_, in {{city}}, {{county}} County, Michigan, in the presence of the two witnesses named below.

[SIGNATURE] Principal

The foregoing Durable Power of Attorney was signed, sealed, published, and declared by the above-named Principal in our presence as the Principal's free and voluntary act for the purposes set forth therein. We, in the Principal's presence and in the presence of each other, have subscribed our names as witnesses. Neither of us is the Agent named in this document.

[SIGNATURE] Witness One — Printed Name and Address

[SIGNATURE] Witness Two — Printed Name and Address

[NOTARY_BLOCK]
## NOTARY ACKNOWLEDGMENT

Recommended under MCL 556.205 to enhance third-party acceptance

## STATE OF MICHIGAN

COUNTY OF {{county_upper}}

On this _ day of _, 20_, before me, the undersigned, a Notary Public in and for said County and State, personally appeared {{client_full_name}}, known to me (or satisfactorily proven) to be the person whose name is subscribed to the within instrument, and who acknowledged that the person executed the same as the person's free and voluntary act for the purposes set forth therein.

## NOTARY ACKNOWLEDGMENT

Notary Public, State of Michigan

County of __  ·  Acting in {{county}} County, Michigan

My commission expires: _
[/NOTARY_BLOCK]

## AGENT'S ACKNOWLEDGMENT OF DUTIES

Pursuant to MCL 556.213, Michigan Uniform Power of Attorney Act

## IMPORTANT NOTICE TO AGENT

Each Agent (primary and any Successor Agent) is requested to sign this Acknowledgment before exercising authority under this Durable Power of Attorney. Although signing this Acknowledgment is not a strict prerequisite to the Agent's authority, it is strongly recommended Michigan practice and confirms the Agent's understanding of the Agent's duties. Failure to sign does NOT mitigate the Agent's potential liability for breach of fiduciary duty.

I, the undersigned Agent, accept appointment as Agent under the foregoing Durable Power of Attorney. I acknowledge that:

(1)  I understand that I have been granted authority to act on behalf of the Principal in financial matters as set forth in the foregoing Durable Power of Attorney;

(2)  I have duties to the Principal under the Michigan Uniform Power of Attorney Act, MCL 556.201 et seq., including the duty to act loyally for the Principal's benefit; the duty to act in good faith; the duty to act with the care, competence, and diligence ordinarily exercised by agents in similar circumstances; and the duty to keep records of all transactions conducted on the Principal's behalf;

(3)  I will keep the Principal's property separate from my own property;

(4)  I will cooperate with any person who has authority to make health care decisions for the Principal;

(5)  I will attempt to preserve the Principal's estate plan, to the extent actually known by me, if preserving the plan is consistent with the Principal's best interest;

(6)  I understand that I may be held personally liable for any breach of fiduciary duty;

(7)  I understand that the Principal may revoke this Durable Power of Attorney at any time while the Principal is competent.

Primary Agent: {{dpoa_agent.full_name}}

[SIGNATURE] Primary Agent — Signature and Date

First Successor Agent (sign when assuming role): {{first_successor_dpoa_agent.full_name}}

[SIGNATURE] First Successor Agent — Signature and Date

Second Successor Agent (sign when assuming role): {{second_successor_dpoa_agent.full_name}}

[SIGNATURE] Second Successor Agent — Signature and Date
`;

export default template;
