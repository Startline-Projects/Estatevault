const template = `
REVOCABLE LIVING TRUST

AGREEMENT

OF

{{client_full_name_upper}}

{{trust_name_display_upper}}

Grantor: {{client_full_name}}  ·  Date of Birth: {{client_dob}}

Residence: {{street_address}}, {{city}}, {{county}} County, Michigan  {{zip}}

Marital Status: {{marital_status_label}}

{{#IF trustee_is_self equals true}}

Initial Trustee: {{client_full_name}} (Grantor serving as Trustee)

{{/IF}}

{{#IF trustee_is_self equals false}}

Initial Trustee: {{trustee.full_name}}  ·  {{trustee.relationship}}

{{/IF}}

First Successor Trustee: {{successor_trustee.full_name}}

{{#IF second_successor_trustee}}

Second Successor Trustee: {{second_successor_trustee.full_name}}

{{/IF}}

## OPERATION OF THIS DOCUMENT

This is your Revocable Living Trust under Michigan law (MCL 700.7101 et seq., the Estates and Protected Individuals Code). During your lifetime, you retain full control over the Trust and may amend, modify, or revoke it at any time while you have legal capacity to do so. Upon your passing, this Trust becomes irrevocable and the distribution provisions take effect.

State of Michigan  ·  Michigan EPIC, MCL 700.7101 et seq.

Michigan Uniform Fiduciary Access to Digital Assets Act, MCL 700.1003 et seq.

{{#IF attorney_review_purchased}}

## ATTORNEY REVIEWED & APPROVED

Reviewing Attorney: {{reviewing_attorney_name}}  ·  Bar No. {{reviewing_attorney_bar_number}}

Firm: {{reviewing_attorney_firm}}  ·  Reviewed: {{review_date}}

{{/IF}}

I, {{client_full_name}}, a resident of the City of {{city}}, County of {{county}}, State of Michigan, being of sound mind and not acting under duress, menace, fraud, or the undue influence of any person, do hereby establish this Revocable Living Trust, to be known as "{{trust_name_display}}," and do hereby transfer and assign to the Trustee the property described in Schedule A attached hereto, to be held, administered, and distributed in accordance with the terms and conditions set forth herein.

## ARTICLE I — TRUST DECLARATION AND IDENTIFICATION

### Section 1.1 — Creation of Trust.

This Trust is established on the date of execution set forth below and shall be known as "{{trust_name_display}}."

### Section 1.2 — Identification of Grantor.

I am the Grantor of this Trust. I am a resident of the State of Michigan. I was born on {{client_dob}}. My current residence address is {{street_address}}, {{city}}, Michigan {{zip}}.

### Section 1.3 — Marital Status.

{{#IF marital_status equals "Married"}}

I am married. My spouse is {{spouse_full_name}}. All references in this Trust to "my spouse" refer to {{spouse_full_name}}.

{{/IF}}

{{#IF marital_status equals "Single"}}

I am single. I am not currently married and have no spouse at the time of executing this Trust.

{{/IF}}

{{#IF marital_status equals "Divorced"}}

I am divorced. I am not currently married and have no spouse at the time of executing this Trust.

{{/IF}}

{{#IF marital_status equals "Widowed"}}

I am widowed. I am not currently married and have no spouse at the time of executing this Trust.

{{/IF}}

### Section 1.4 — Children.

{{#IF has_children equals true}}

I have the following children:

{{#FOREACH children}}

  •  {{full_name}}, born on {{date_of_birth}}

{{/FOREACH}}

Any reference in this Trust to "my children" includes the children identified above and any children later born to me or legally adopted by me, unless the context clearly requires otherwise.

{{/IF}}

{{#IF has_children equals false}}

I have no living children at the time of executing this Trust. Any reference in this Trust to "my children" shall include any children later born to me or legally adopted by me.

{{/IF}}

## ARTICLE II — REVOCABILITY

### Section 2.1 — Reservation of Right to Amend, Modify, or Revoke.

The Grantor reserves the right to amend, modify, or revoke this Trust in whole or in part at any time during the Grantor's lifetime, provided the Grantor has legal capacity to do so. Any amendment or modification must be in writing, signed by the Grantor, and delivered to the Trustee.

### Section 2.2 — Effect of Revocation.

Upon revocation, the Trustee shall transfer and deliver all Trust property to the Grantor, or as the Grantor may direct. Upon the Grantor's passing, this Trust shall become irrevocable, and no further amendments, modifications, or revocations may be made.

## ARTICLE III — TRUSTEE APPOINTMENT AND SUCCESSION

{{#IF trustee_is_self equals true}}

### Section 3.1 — Initial Trustee.

The Grantor shall serve as the initial Trustee of this Trust during the Grantor's lifetime and while the Grantor has legal capacity to manage the Trust assets.

{{/IF}}

{{#IF trustee_is_self equals false}}

### Section 3.1 — Initial Trustee.

I appoint {{trustee.full_name}}, currently residing in {{trustee.city}}, {{trustee.state}}, to serve as the initial Trustee of this Trust. The Trustee is my {{trustee.relationship}}.

{{/IF}}

### Section 3.2 — First Successor Trustee.

If the initial Trustee is unable or unwilling to serve, ceases to serve for any reason, or in the event of the Grantor's incapacity (as determined under Article IV), I appoint {{successor_trustee.full_name}}, currently residing in {{successor_trustee.city}}, {{successor_trustee.state}}, to serve as First Successor Trustee.

{{#IF second_successor_trustee}}

### Section 3.3 — Second Successor Trustee.

If both the initial Trustee and {{successor_trustee.full_name}} are unable or unwilling to serve, I appoint {{second_successor_trustee.full_name}}, currently residing in {{second_successor_trustee.city}}, {{second_successor_trustee.state}}, to serve as Second Successor Trustee.

{{/IF}}

### Section 3.4 — Court Appointment.

If all named Trustees and Successor Trustees are unable or unwilling to serve, a Michigan court of competent jurisdiction shall appoint a successor Trustee.

### Section 3.5 — Bond.

No Trustee or Successor Trustee named in this Trust shall be required to furnish a bond or other security in any jurisdiction.

### Section 3.6 — Trustee Compensation.

Any Trustee serving under this Trust shall be entitled to reasonable compensation for services rendered, in accordance with Michigan law.

## ARTICLE IV — INCAPACITY

### Section 4.1 — Determination of Incapacity.

The Grantor shall be deemed incapacitated only upon written certification by two (2) licensed physicians that the Grantor is unable to manage the Grantor's financial affairs. Each physician's certification shall be in the form of a signed, dated written statement that includes the physician's full name, professional license number, a statement that the physician has examined the Grantor, and the physician's professional opinion that the Grantor is unable to manage the Grantor's financial affairs by reason of mental or physical incapacity.

### Section 4.2 — Authority of Successor Trustee During Incapacity.

Upon the determination of the Grantor's incapacity as provided in Section 4.1, the Successor Trustee shall assume management of the Trust without court intervention and shall have all powers and authority granted to the Trustee under this Trust. The Successor Trustee shall manage the Trust assets for the benefit of the Grantor during the period of incapacity, including paying the Grantor's living expenses, medical costs, and other obligations from Trust assets.

### Section 4.3 — Restoration of Capacity.

If the Grantor subsequently regains capacity, as certified in writing by a licensed physician, the Grantor shall resume serving as Trustee and the Successor Trustee's authority shall terminate.

## ARTICLE V — TRUSTEE POWERS

### Section 5.1 — General Grant of Powers.

In addition to all powers conferred by Michigan law, including those set forth in MCL 700.7815 and related provisions of the Estates and Protected Individuals Code, the Trustee shall have the following powers, exercisable in the Trustee's sole discretion, without prior court approval.

### Section 5.2 — Specific Powers.

The Trustee shall have full power and authority to invest and reinvest trust assets in any type of property, including stocks, bonds, mutual funds, real estate, and other investments, without being limited by any rule of law regarding permissible investments for trust funds; buy, sell, lease, mortgage, or otherwise manage real and personal property of the Trust; borrow money and encumber trust assets when the Trustee deems it advisable; employ and compensate attorneys, accountants, investment advisors, and other professionals; make distributions in cash or in kind, or partly in cash and partly in kind; pay taxes, debts, and expenses of administration from trust assets; operate, continue, or dispose of any business interest held in the Trust; vote shares of stock and exercise other ownership rights with respect to securities; settle, compromise, or abandon claims in favor of or against the Trust; and continue any investment or business of the Grantor.

### Section 5.3 — Banking Powers.

The Trustee shall have full authority to open, maintain, and close bank accounts and financial accounts in the name of the Trust; deposit and withdraw funds; write, endorse, and negotiate checks; make electronic transfers and wire transfers; access safe deposit boxes; conduct all banking and financial transactions on behalf of the Trust; execute any documents or agreements required by financial institutions; and exercise all banking powers with respect to any financial institution that the Grantor could exercise individually, as authorized under MCL 700.7815.

## ARTICLE VI — SPECIFIC GIFTS

{{#IF has_specific_gifts equals true}}

I direct the Trustee to make the following specific gifts from the Trust estate:

{{#FOREACH specific_gifts}}

### Section 6.{{loop_index}}

I give {{item_description}} to {{recipient_full_name}}, my {{recipient_relationship}}.

{{#IF fallback equals "residuary"}}

If the recipient does not survive me by thirty (30) days, this gift shall lapse and become part of the residuary Trust estate.

{{/IF}}

{{#IF fallback equals "to_children"}}

If the recipient does not survive me by thirty (30) days, this gift shall pass to the then-living children of the recipient, in equal shares, per stirpes.

{{/IF}}

{{/FOREACH}}

{{/IF}}

{{#IF has_specific_gifts equals false}}

No specific gifts are made under this Trust. All Trust assets shall be distributed as provided in Article VII.

{{/IF}}

## ARTICLE VII — DISTRIBUTION OF TRUST ESTATE

### Section 7.1 — Primary Beneficiaries.

Upon the Grantor's passing, after payment of all debts, expenses of administration, and specific gifts (if any), the Trustee shall distribute the remaining Trust estate to the following beneficiaries in the shares indicated:

{{#FOREACH primary_beneficiaries}}

  •  {{share_percent}}% to {{full_name}}, my {{relationship}}.

{{#IF per_stirpes equals true}}

        If {{full_name}} does not survive me by thirty (30) days, this share shall pass to the then-living descendants of {{full_name}}, per stirpes.

{{/IF}}

{{#IF per_stirpes equals false}}

        If {{full_name}} does not survive me by thirty (30) days, this share shall be distributed proportionally among the other primary beneficiaries named in this Section.

{{/IF}}

{{/FOREACH}}

### Section 7.2 — Remainder Beneficiaries.

{{#IF contingent_beneficiaries_not_empty}}

If all of the primary beneficiaries named in Section 7.1 fail to survive me by thirty (30) days, I direct the Trustee to distribute the Trust estate to the following remainder beneficiaries in the shares indicated:

{{#FOREACH contingent_beneficiaries}}

  •  {{share_percent}}% to {{full_name}}, my {{relationship}}.

{{/FOREACH}}

{{/IF}}

### Section 7.3 — Final Disposition.

If all of the primary beneficiaries named in Section 7.1, and all of the remainder beneficiaries named in Section 7.2 (if any), fail to survive me by thirty (30) days, the Trust estate shall be distributed to my heirs at law, as determined under the laws of the State of Michigan governing intestate succession, in effect at the time of my passing.

### Section 7.4 — Survivorship Requirement.

For the purposes of this Trust, a beneficiary shall be considered to have survived me only if such beneficiary is living on the thirtieth (30th) day following the date of my passing.

## ARTICLE VIII — MINOR BENEFICIARY PROTECTION

### Section 8.1 — Sub-Trust for Minor Beneficiaries.

If any beneficiary is under the age of {{distribution_age}} at the time of distribution, the Trustee shall hold that beneficiary's share in a separate sub-trust and shall administer such sub-trust as follows:

(a) The Trustee shall make distributions from the sub-trust for the beneficiary's health, education, maintenance, and support, in amounts and at times as the Trustee determines appropriate in the Trustee's sole discretion.

(b) The Trustee shall distribute the remaining balance of the sub-trust to the beneficiary upon the beneficiary's attainment of the age of {{distribution_age}}.

(c) If the beneficiary does not survive to the age of {{distribution_age}}, the remaining sub-trust assets shall be distributed to the then-living descendants of the beneficiary, per stirpes, or if there are no such descendants, to the remaining beneficiaries of this Trust proportionally.

{{#IF has_minor_children equals true}}

## ARTICLE IX — GUARDIAN FOR MINOR CHILDREN

### Section 9.1 — Nomination of Guardian.

If at the time of my passing any of my children are minors, and if the other natural parent of such minor child is no longer living or is otherwise unable to serve as guardian, I nominate {{guardian.full_name}}, currently residing in {{guardian.city}}, {{guardian.state}}, to serve as Guardian of the person of such minor children. This nomination is made pursuant to MCL 700.5202.

### Section 9.2 — Successor Guardian.

If {{guardian.full_name}} is unable or unwilling to serve, or for any reason ceases to serve, I nominate {{successor_guardian.full_name}} to serve as Successor Guardian.

### Section 9.3 — Best Interests of the Children.

I have nominated the persons named in this Article because I believe each, in his or her own way, would act in the best interests of my minor children. Any court of competent jurisdiction reviewing this nomination is requested to honor my choice unless there is clear and compelling reason to do otherwise.

{{/IF}}

## ARTICLE X — SPENDTHRIFT PROVISION

### Section 10.1 — Restriction on Anticipation and Assignment.

No beneficiary shall have the power to anticipate, pledge, assign, or otherwise encumber any interest in this Trust before actual receipt of a distribution. No interest of any beneficiary shall be subject to the claims of creditors or to attachment, execution, garnishment, or other legal process. This provision shall be enforced to the fullest extent permitted by Michigan law.

## ARTICLE XI — NO-CONTEST CLAUSE

{{#IF no_contest_clause equals true}}

### Section 11.1 — Forfeiture of Interest.

If any beneficiary under this Trust, or any person who would benefit under this Trust, directly or indirectly contests this Trust or any of its provisions, or seeks to invalidate, set aside, or modify this Trust or any of its provisions, then any share or interest in the Trust estate otherwise passing to such person shall be forfeited. The forfeited share shall be redistributed among the remaining beneficiaries in proportion to their respective shares, as if the contesting beneficiary had predeceased me without issue. This provision shall be enforced to the fullest extent permitted by Michigan law. This provision shall not apply to a contest brought in good faith and with probable cause.

{{/IF}}

{{#IF no_contest_clause equals false}}

### Section 11.1 — No No-Contest Clause.

This Trust contains no no-contest clause. Any beneficiary who wishes to contest this Trust may do so in accordance with Michigan law.

{{/IF}}

## ARTICLE XII — DIGITAL ASSETS

### Section 12.1 — Digital Asset Authority.

Pursuant to the Michigan Fiduciary Access to Digital Assets Act (MCL 700.1003 et seq.), the Trustee shall have full authority to access, manage, and distribute digital assets held in or belonging to the Trust, including but not limited to online accounts, digital files, cryptocurrency holdings, digital wallets, domain names, and intellectual property stored digitally. The Trustee may consent on behalf of the Grantor to disclosure of the content of electronic communications under federal and state law.

## ARTICLE XIII — GENERAL PROVISIONS

### Section 13.1 — Severability.

If any provision of this Trust is held to be invalid, unenforceable, or contrary to law, the remaining provisions shall continue in full force and effect, and the invalid provision shall be reformed only to the extent necessary to render it valid and enforceable.

### Section 13.2 — Governing Law.

This Trust shall be governed by and construed in accordance with the laws of the State of Michigan, including the Estates and Protected Individuals Code (MCL 700.1101 et seq.).

### Section 13.3 — References to Michigan Law.

All references in this Trust to "Michigan law" or to specific provisions of the Michigan Compiled Laws shall be construed to include any successor statutes, amendments, or recodifications, unless the context clearly requires otherwise.

### Section 13.4 — Definitions and Construction.

References to "the Trustee" include any Successor Trustee duly serving in that role. References to a person's descendants mean lineal descendants of that person. Words denoting one gender include all genders. The headings of Articles and Sections are for convenience of reference only and shall not affect the construction of this Trust.

## ATTESTATION

IN WITNESS WHEREOF, I, {{client_full_name}}, the Grantor, sign my name to this Revocable Living Trust Agreement on this _ day of _, 20_, in {{city}}, {{county}} County, Michigan, declaring that I establish this Trust willingly, that I execute it as my free and voluntary act, and that I am of legal age (eighteen years or older) and of sound mind, and under no constraint or undue influence.

[SIGNATURE] Grantor

The foregoing Revocable Living Trust Agreement was signed and declared by the above-named Grantor in our presence; and we, at the Grantor's request and in the Grantor's presence and in the presence of each other, have hereunto subscribed our names as witnesses thereto.

[SIGNATURE] Witness One — Printed Name and Address

[SIGNATURE] Witness Two — Printed Name and Address

{{#IF trustee_is_self equals false}}

## TRUSTEE ACCEPTANCE

I, {{trustee.full_name}}, accept appointment as Trustee of {{trust_name_display}} and acknowledge that I have read and understand the terms of this Trust and agree to administer the Trust in accordance with its provisions and applicable Michigan law.

[SIGNATURE] Trustee — Signature and Date

{{/IF}}

## SCHEDULE A — TRUST ASSETS

The following assets are transferred to and shall be held as part of {{trust_name_display}}:

{{#IF has_assets equals true}}

{{#FOREACH assets}}

  •  {{value}}

{{/FOREACH}}

{{/IF}}

{{#IF has_assets equals false}}

[The Grantor shall transfer assets to this Trust by retitling ownership to the Trust or by assignment. Assets not listed here may be added at any time during the Grantor's lifetime by deed, assignment, or other transfer instrument naming the Trust as the owner or beneficiary.]

{{/IF}}

## SELF-PROVING AFFIDAVIT

Pursuant to MCL 700.7403

## STATE OF MICHIGAN

COUNTY OF {{county_upper}}

Before me, the undersigned authority, on this _ day of _, 20_, personally appeared {{client_full_name}}, the Grantor, and _ and _, the witnesses, whose names are signed to the attached or foregoing instrument, and, all of these persons being by me first duly sworn, the Grantor declared to me and to the witnesses in my presence that the instrument is the Grantor's Revocable Living Trust Agreement and that the Grantor had willingly signed and executed it as the Grantor's free and voluntary act for the purposes therein expressed; and each of the witnesses stated to me, in the presence and hearing of the Grantor, that the witness signed the Trust Agreement as a witness and that to the best of the witness's knowledge the Grantor was at that time eighteen years of age or older, of sound mind, and under no constraint or undue influence.

[SIGNATURE] Grantor

[SIGNATURE] Witness One

[SIGNATURE] Witness Two

Sworn to and signed in my presence by {{client_full_name}}, the Grantor, and sworn to and signed in my presence by the two witnesses named above, on this _ day of _, 20_.

[NOTARY_BLOCK]
## NOTARY ACKNOWLEDGMENT

Notary Public, State of Michigan

County of   ·  Acting in {{county}} County, Michigan

My commission expires: _
[/NOTARY_BLOCK]
`;

export default template;
