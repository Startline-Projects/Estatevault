const template = `
LAST WILL AND TESTAMENT

OF

{{client_full_name_upper}}

Testator: {{client_full_name}}  ·  Date of Birth: {{client_dob}}

Residence: {{street_address}}, {{city}}, {{county}} County, Michigan  {{zip}}

Marital Status: {{marital_status_label}}

## OPERATION OF THIS DOCUMENT

This is your Last Will and Testament under Michigan law (MCL 700.2502 et seq.). This document takes effect upon your death. While you are living, you continue to own and control your property exactly as before. You may revoke or amend this Will at any time while you are competent.

State of Michigan  ·  Michigan EPIC, MCL 700.2502 et seq.

Michigan Uniform Fiduciary Access to Digital Assets Act, MCL 700.1003 et seq.

{{#IF attorney_review_purchased}}

## ATTORNEY REVIEWED & APPROVED

Reviewing Attorney: {{reviewing_attorney_name}}  ·  Bar No. {{reviewing_attorney_bar_number}}

Firm: {{reviewing_attorney_firm}}  ·  Reviewed: {{review_date}}

{{/IF}}

I, {{client_full_name}}, a resident of the City of {{city}}, County of {{county}}, State of Michigan, being of sound mind and not acting under duress, menace, fraud, or the undue influence of any person, do hereby make, publish, and declare this instrument to be my Last Will and Testament, and hereby revoke any and all wills and codicils heretofore made by me.

## ARTICLE I — IDENTIFICATION AND FAMILY

### Section 1.1 — Identification of Testator.

I am a resident of the State of Michigan. I was born on {{client_dob}}. My current residence address is {{street_address}}, {{city}}, Michigan {{zip}}.

### Section 1.2 — Marital Status.

{{#IF marital_status equals "Married"}}

I am married. My spouse is {{spouse_full_name}}. All references in this Will to "my spouse" refer to {{spouse_full_name}}.

{{/IF}}

{{#IF marital_status equals "Single"}}

I am single. I am not currently married and have no spouse at the time of executing this Will.

{{/IF}}

{{#IF marital_status equals "Divorced"}}

I am divorced. I am not currently married and have no spouse at the time of executing this Will. Any provision of this Will in favor of a former spouse is revoked by operation of Michigan law pursuant to MCL 700.2807.

{{/IF}}

{{#IF marital_status equals "Widowed"}}

I am widowed. I am not currently married and have no spouse at the time of executing this Will.

{{/IF}}

### Section 1.3 — Children.

{{#IF has_children equals true}}

I have the following children, all of whom are referenced by name in this Will:

{{#FOREACH children}}

  •  {{full_name}}, born on {{date_of_birth}}

{{/FOREACH}}

Any reference in this Will to "my children" includes the children identified above and any children later born to me or legally adopted by me, unless the context clearly requires otherwise.

{{/IF}}

{{#IF has_children equals false}}

I have no living children at the time of executing this Will. Any reference in this Will to "my children" shall include any children later born to me or legally adopted by me.

{{/IF}}

## ARTICLE II — PERSONAL REPRESENTATIVE

### Section 2.1 — Appointment.

I nominate and appoint {{personal_representative.full_name}}, currently residing in {{personal_representative.city}}, {{personal_representative.state}}, to serve as the Personal Representative of my estate.

### Section 2.2 — Successor Personal Representatives.

If {{personal_representative.full_name}} is unable or unwilling to serve, predeceases me, or for any reason ceases to serve, I nominate {{successor_personal_representative.full_name}}, currently residing in {{successor_personal_representative.city}}, {{successor_personal_representative.state}}, to serve as Successor Personal Representative.

{{#IF second_successor_personal_representative}}

If both {{personal_representative.full_name}} and {{successor_personal_representative.full_name}} are unable or unwilling to serve, predecease me, or for any reason cease to serve, I nominate {{second_successor_personal_representative.full_name}}, currently residing in {{second_successor_personal_representative.city}}, {{second_successor_personal_representative.state}}, to serve as Second Successor Personal Representative.

{{/IF}}

### Section 2.3 — Bond.

{{#IF bond_waiver equals true}}

I direct that no bond or other security shall be required of any Personal Representative or Successor Personal Representative named in this Will, whether appointed in Michigan or elsewhere.

{{/IF}}

{{#IF bond_waiver equals false}}

The Personal Representative shall provide such bond as may be required by the court of competent jurisdiction administering my estate.

{{/IF}}

### Section 2.4 — Independent Administration.

{{#IF independent_administration equals true}}

I authorize my Personal Representative to administer my estate in an unsupervised independent administration under the Estates and Protected Individuals Code of the State of Michigan, without the necessity of court supervision other than as expressly required by Michigan law.

{{/IF}}

### Section 2.5 — Powers of the Personal Representative.

In addition to all powers granted by Michigan law, my Personal Representative shall have full power and authority, without prior court approval, to take possession of and manage all property of my estate; pay all just debts, funeral expenses, expenses of administration, and taxes; sell, lease, exchange, or otherwise dispose of any real or personal property of my estate, at public or private sale, with or without notice, for cash or on credit, and upon such terms as the Personal Representative deems advisable; distribute property in cash or in kind, or partly in cash and partly in kind, and to make such distributions on a non-pro-rata basis; compromise, settle, or abandon any claim in favor of or against my estate; employ and compensate attorneys, accountants, investment advisors, and other professionals; and exercise all powers granted to personal representatives under MCL 700.3715 and other applicable provisions of Michigan law.

### Section 2.6 — Compensation.

My Personal Representative shall be entitled to reasonable compensation for services rendered, in accordance with Michigan law.

## ARTICLE III — PAYMENT OF DEBTS, EXPENSES, AND TAXES

### Section 3.1 — Debts and Expenses.

I direct my Personal Representative to pay from my residuary estate all of my just debts, the expenses of my last illness, funeral expenses, and the expenses of administering my estate, as soon as practicable after my death. No debt shall be paid that is barred by the statute of limitations or the non-claim statute, except in the discretion of my Personal Representative.

### Section 3.2 — Taxes.

I direct that all estate, inheritance, succession, and similar taxes (collectively, "Death Taxes") imposed by reason of my death, together with interest and penalties thereon, be paid from my residuary estate, without apportionment or reimbursement from any beneficiary. This provision shall not apply to any taxes on property over which I have a power of appointment or to taxes that, by their terms, must be borne by the recipient of the property generating the tax.

## ARTICLE IV — SPECIFIC GIFTS

{{#IF has_specific_gifts equals true}}

I make the following specific gifts:

{{#FOREACH specific_gifts}}

### Section 4.{{loop_index}}

I give, devise, and bequeath {{item_description}} to {{recipient_full_name}}, my {{recipient_relationship}}.

{{#IF fallback equals "residuary"}}

If the recipient does not survive me by thirty (30) days, this gift shall lapse and become part of my residuary estate.

{{/IF}}

{{#IF fallback equals "to_children"}}

If the recipient does not survive me by thirty (30) days, this gift shall pass to the then-living children of the recipient, in equal shares, per stirpes.

{{/IF}}

{{/FOREACH}}

{{/IF}}

### Section 4.M — Personal Property Memorandum.

I may from time to time prepare a written, signed, and dated memorandum disposing of specific items of tangible personal property. Pursuant to MCL 700.2513, such a memorandum, if it exists and can be located at the time of my death, shall be given effect to the extent permitted by Michigan law.

## ARTICLE V — RESIDUARY ESTATE

### Section 5.1 — Primary Beneficiaries.

I give, devise, and bequeath all the rest, residue, and remainder of my estate, of every kind and nature and wherever situated (my "residuary estate"), to the following persons in the shares indicated:

{{#FOREACH primary_beneficiaries}}

  •  {{share_percent}}% to {{full_name}}, my {{relationship}}.

{{#IF per_stirpes equals true}}

        If {{full_name}} does not survive me by thirty (30) days, this share shall pass to the then-living descendants of {{full_name}}, per stirpes.

{{/IF}}

{{#IF per_stirpes equals false}}

        If {{full_name}} does not survive me by thirty (30) days, this share shall be distributed proportionally among the other primary beneficiaries named in this Section.

{{/IF}}

{{/FOREACH}}

### Section 5.2 — Contingent Beneficiaries.

{{#IF contingent_beneficiaries_not_empty}}

If all of the primary beneficiaries named in Section 5.1 fail to survive me by thirty (30) days, I give, devise, and bequeath my residuary estate to the following contingent beneficiaries in the shares indicated:

{{#FOREACH contingent_beneficiaries}}

  •  {{share_percent}}% to {{full_name}}, my {{relationship}}.

{{/FOREACH}}

{{/IF}}

### Section 5.3 — Final Disposition.

If all of the primary beneficiaries named in Section 5.1, and all of the contingent beneficiaries named in Section 5.2 (if any), fail to survive me by thirty (30) days, my residuary estate shall pass to my heirs at law, as determined under the laws of the State of Michigan governing intestate succession, in effect at the time of my death.

### Section 5.4 — Survivorship Requirement.

For the purposes of this Will, a beneficiary shall be considered to have survived me only if such beneficiary is living on the thirtieth (30th) day following the date of my death.

{{#IF has_minor_children equals true}}

## ARTICLE VI — GUARDIAN FOR MINOR CHILDREN

### Section 6.1 — Nomination of Guardian.

If at the time of my death any of my children are minors, and if the other natural parent of such minor child is deceased or otherwise unable to serve as guardian, I nominate {{guardian.full_name}}, currently residing in {{guardian.city}}, {{guardian.state}}, to serve as Guardian of the person of such minor children. This nomination is made pursuant to MCL 700.5202.

### Section 6.2 — Successor Guardian.

If {{guardian.full_name}} is unable or unwilling to serve, predeceases me, or for any reason ceases to serve, I nominate {{successor_guardian.full_name}} to serve as Successor Guardian.

{{#IF standby_guardian}}

### Section 6.3 — Standby Guardian.

If both {{guardian.full_name}} and {{successor_guardian.full_name}} are unable or unwilling to serve, I nominate {{standby_guardian.full_name}} to serve as Standby Guardian.

{{/IF}}

### Section 6.4 — Temporary Incapacity Authority.

{{#IF guardian_temporary_incapacity_authority equals true}}

Pursuant to MCL 700.5204, if I am alive but temporarily unable to care for my minor children due to physical or mental incapacity, hospitalization, or other similar circumstance, the Guardian nominated above (or any successor or standby Guardian) shall have the authority to care for my minor children during the period of my incapacity. This authority shall be exercised in the best interests of my minor children and shall terminate upon my recovery or the appointment of a guardian by a court of competent jurisdiction.

{{/IF}}

{{#IF guardian_temporary_incapacity_authority equals false}}

The Guardian nominated in this Article VI is nominated only for the period following my death and is not authorized to act on my behalf during any period of my temporary incapacity.

{{/IF}}

### Section 6.5 — Best Interests of the Children.

I have nominated the persons named in this Article VI because I believe each, in his or her own way, would act in the best interests of my minor children. Any court of competent jurisdiction reviewing this nomination is requested to honor my choice unless there is clear and compelling reason to do otherwise.

{{/IF}}

## ARTICLE VII — DIGITAL ASSETS

### Section 7.1 — Designation of Digital Asset Agent.

{{#IF digital_executor_is_same equals true}}

Pursuant to the Michigan Fiduciary Access to Digital Assets Act (MCL 700.1003 et seq.), I hereby designate my Personal Representative named in Article II as the person authorized to access, manage, copy, control, and terminate my digital assets and electronic communications, including but not limited to email accounts, social media profiles, cloud storage accounts, online financial accounts, cryptocurrency holdings, digital wallets, domain names, and any other electronic records or communications in which I have an interest.

{{/IF}}

{{#IF digital_executor_is_same equals false}}

Pursuant to the Michigan Fiduciary Access to Digital Assets Act (MCL 700.1003 et seq.), I hereby designate {{digital_executor.full_name}}, my {{digital_executor.relationship}}, as the person authorized to access, manage, copy, control, and terminate my digital assets and electronic communications, including but not limited to email accounts, social media profiles, cloud storage accounts, online financial accounts, cryptocurrency holdings, digital wallets, domain names, and any other electronic records or communications in which I have an interest.

{{/IF}}

### Section 7.2 — Scope of Authority.

My designated digital asset agent shall have full authority to access the content of my electronic communications; manage and dispose of my digital assets in accordance with my instructions; provide consent to any custodian, service provider, or other holder of my digital assets for the disclosure and management of those assets; and take any other action necessary or appropriate to give effect to this designation.

### Section 7.3 — Instructions for Digital Assets.

{{#IF digital_asset_instructions equals "Preserve all accounts. My digital executor preserves access where possible and passes credentials to my beneficiaries."}}

My digital asset agent shall, to the extent reasonably possible, preserve access to my digital accounts and shall pass the necessary credentials, access information, and instructions to the appropriate beneficiaries of my residuary estate.

{{/IF}}

{{#IF digital_asset_instructions equals "Close social media and personal accounts. My digital executor closes social media, email, and personal subscription accounts after handling any final matters."}}

My digital asset agent shall close my social media accounts, email accounts, and personal subscription accounts after handling any final matters that may require attention, including memorial notices, return of subscription fees, and protection of personal communications.

{{/IF}}

{{#IF digital_asset_instructions equals "Transfer financial and cryptocurrency assets, close everything else. My digital executor transfers any financial or cryptocurrency assets to my beneficiaries and closes the remaining accounts."}}

My digital asset agent shall transfer any digital financial accounts and cryptocurrency holdings to the beneficiaries of my residuary estate in proportion to the shares set forth in Article V, and shall close all other digital accounts after handling any final matters.

{{/IF}}

{{#IF digital_asset_instructions equals "Decision left to my digital executor."}}

I leave the decisions regarding the management and disposition of my digital assets to the sound discretion of my digital asset agent, who shall act in good faith and in accordance with applicable law.

{{/IF}}

## ARTICLE VIII — FINAL WISHES

### Section 8.1 — Organ and Tissue Donation.

{{#IF organ_donation equals "yes_all"}}

I authorize the donation of any of my organs, tissues, eyes, or other body parts that may be useful for the purposes of transplantation, therapy, research, or education. This authorization is made pursuant to Michigan's Uniform Anatomical Gift Act, MCL 333.10101 et seq.

{{/IF}}

{{#IF organ_donation equals "yes_specific"}}

I authorize the donation of my organs, tissues, eyes, or other body parts for the following specific purposes only: {{organ_donation_purposes_joined}}. No donation shall be made for any purpose not listed above.

{{/IF}}

{{#IF organ_donation equals "no"}}

I do not authorize the donation of any of my organs, tissues, or body parts. My wishes regarding non-donation shall be respected to the fullest extent permitted by law.

{{/IF}}

{{#IF organ_donation equals "advocate_decides"}}

I leave the decision regarding organ, tissue, and body part donation to my Patient Advocate designated in my separate Patient Advocate Designation, or, if no Patient Advocate is available, to my surviving family members in accordance with the priorities established under Michigan's Uniform Anatomical Gift Act, MCL 333.10101 et seq.

{{/IF}}

### Section 8.2 — Funeral and Burial Preference.

{{#IF funeral_preference equals "burial"}}

It is my preference that my remains be interred by burial. My Personal Representative, in coordination with my Funeral Representative (if any), shall make the final arrangements consistent with this preference and with the resources of my estate.

{{/IF}}

{{#IF funeral_preference equals "cremation"}}

It is my preference that my remains be disposed of by cremation. My Personal Representative, in coordination with my Funeral Representative (if any), shall make the final arrangements consistent with this preference and with the resources of my estate.

{{/IF}}

{{#IF funeral_preference equals "family_decides"}}

I leave the decision regarding the manner of disposition of my remains (whether burial, cremation, or other lawful method) to my Funeral Representative (if any) or, if no Funeral Representative has been designated, to my surviving family members.

{{/IF}}

### Section 8.3 — Reference to Funeral Representative Designation.

{{#IF has_funeral_representative equals true}}

I have executed a separate Funeral Representative Designation pursuant to MCL 700.3206, in which I have designated {{funeral_representative.full_name}} as my Funeral Representative. That designation governs the authority over my funeral and burial arrangements and is incorporated by reference into this Will to the extent permitted by Michigan law.

{{/IF}}

## ARTICLE IX — INTENTIONAL EXCLUSIONS AND NO-CONTEST CLAUSE

### Section 9.1 — Intentional Exclusions.

{{#IF has_intentional_exclusions equals true}}

I have intentionally and not as a result of accident or oversight made no provision in this Will for the following individuals:

{{#FOREACH intentional_exclusions}}

  •  {{full_name}}, my {{relationship}}.

{{/FOREACH}}

The omission of the persons named above is deliberate. I direct that nothing in this Will be construed to confer any benefit upon any of the persons named in this Section.

{{/IF}}

{{#IF has_intentional_exclusions equals false}}

I have not intentionally excluded any specific individual from this Will by name. The absence of any specific person as a beneficiary of this Will reflects my considered intent at the time of executing this Will.

{{/IF}}

### Section 9.2 — No-Contest Clause.

{{#IF no_contest_clause equals true}}

If any beneficiary under this Will, or any person who would benefit under this Will, directly or indirectly contests this Will or any of its provisions, or seeks to invalidate, set aside, or modify this Will or any of its provisions, then any share or interest in my estate otherwise passing to such person under this Will shall be forfeited. The forfeited share shall be redistributed among the remaining beneficiaries in proportion to their respective shares, as if the contesting beneficiary had predeceased me without issue. This provision shall be enforced to the fullest extent permitted by Michigan law. This provision shall not apply to a contest brought in good faith and with probable cause.

{{/IF}}

{{#IF no_contest_clause equals false}}

This Will contains no no-contest clause. Any beneficiary who wishes to contest this Will may do so in accordance with Michigan law.

{{/IF}}

## ARTICLE X — GENERAL PROVISIONS

### Section 10.1 — Severability.

If any provision of this Will is held to be invalid, unenforceable, or contrary to law, the remaining provisions shall continue in full force and effect, and the invalid provision shall be reformed only to the extent necessary to render it valid and enforceable.

### Section 10.2 — Governing Law.

This Will shall be governed by and construed in accordance with the laws of the State of Michigan in effect at the time of my death.

### Section 10.3 — References to Michigan Law.

All references in this Will to "Michigan law" or to specific provisions of the Michigan Compiled Laws shall be construed to include any successor statutes, amendments, or recodifications, unless the context clearly requires otherwise.

### Section 10.4 — Definitions and Construction.

References to "my Personal Representative" include any Successor Personal Representative or Second Successor Personal Representative duly serving in that role. References to a person's descendants mean lineal descendants of that person. Words denoting one gender include all genders. The headings of Articles and Sections are for convenience of reference only and shall not affect the construction of this Will.

### Section 10.5 — Revocation of Prior Wills.

I hereby revoke any and all prior wills and codicils heretofore made by me, including any oral, holographic, or other testamentary instruments.

## ATTESTATION

IN WITNESS WHEREOF, I, {{client_full_name}}, the Testator, sign my name to this Last Will and Testament on this _ day of _, 20_, and being duly identified by the witnesses below, declare to them that this is my Last Will and Testament, that I sign it willingly, that I execute it as my free and voluntary act, and that I am of legal age (eighteen years or older) and of sound mind, and under no constraint or undue influence.

[SIGNATURE] Testator

The foregoing instrument was signed, sealed, published, and declared by the above-named Testator to be the Testator's Last Will and Testament in our presence; and we, at the Testator's request and in the Testator's presence and in the presence of each other, have hereunto subscribed our names as witnesses thereto.

[SIGNATURE] Witness One — Printed Name and Address

[SIGNATURE] Witness Two — Printed Name and Address

## SELF-PROVING AFFIDAVIT

Pursuant to MCL 700.2504

## STATE OF MICHIGAN

COUNTY OF {{county_upper}}

Before me, the undersigned authority, on this _ day of _, 20_, personally appeared {{client_full_name}}, the Testator, and _ and _, the witnesses, whose names are signed to the attached or foregoing instrument, and, all of these persons being by me first duly sworn, the Testator declared to me and to the witnesses in my presence that the instrument is the Testator's Last Will and Testament and that the Testator had willingly signed and executed it as the Testator's free and voluntary act for the purposes therein expressed; and each of the witnesses stated to me, in the presence and hearing of the Testator, that the witness signed the Will as a witness and that to the best of the witness's knowledge the Testator was at that time eighteen years of age or older, of sound mind, and under no constraint or undue influence.

[SIGNATURE] Testator

[SIGNATURE] Witness One

[SIGNATURE] Witness Two

Sworn to and signed in my presence by {{client_full_name}}, the Testator, and sworn to and signed in my presence by the two witnesses named above, on this _ day of _, 20_.

[NOTARY_BLOCK]
## NOTARY ACKNOWLEDGMENT

Notary Public, State of Michigan

County of   ·  Acting in {{county}} County, Michigan

My commission expires: _
[/NOTARY_BLOCK]
`;

export default template;
