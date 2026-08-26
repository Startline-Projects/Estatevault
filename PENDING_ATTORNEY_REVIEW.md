# Pending Attorney Review

Client-facing prose in the EstateVault documents that was **written by the
development team**, not supplied verbatim by the reviewing attorney. Every entry
here needs attorney sign-off before deploy.

This file is the review source of truth. Prose markers are deliberately **not**
placed inside the `.txt` templates, because a marker inside a template renders
into the delivered document.

## How to use this file

Work top to bottom. **Operative document body** entries come first: that is
language inside the legal instrument itself and carries the most risk.
**Instruction sheet** entries follow, then **questionnaire and UI** text, then
the legacy pdf-lib sheets.

For each entry, either approve the text as written, or supply replacement
wording. Replacement wording goes straight into the template; nothing in this
file is rendered.

## Status

| | |
|---|---|
| Entries awaiting review | 49 |
| Generated | Prompt 6, backfilled across Prompts 1–6 |
| Reviewing attorney | Mo Murshed |
| Also pending | Drake (UPL review), Mike (legal sign-off) — see the compliance checklist |
| Related | `PROMPT6_REGENERATION.md` — schema proposal, not a review item |

---


## Operative document body — language inside the legal instrument

### Last Will and Testament — operative document body

**Where:** Article VIII (Final Wishes), Section 8.2 — Funeral and Burial Preference, all three {{#IF funeral_preference}} branches  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
It is my preference that my remains be interred by burial. My Personal Representative shall make the final arrangements consistent with this preference and with the resources of my estate.

It is my preference that my remains be disposed of by cremation. My Personal Representative shall make the final arrangements consistent with this preference and with the resources of my estate.

I leave the decision regarding the manner of disposition of my remains (whether burial, cremation, or other lawful method) to my Personal Representative, in consultation with my surviving family members.
```

**Why it was written:** The attorney's note directed that funeral and burial preferences be addressed to the Personal Representative rather than to a "Funeral Representative (if any)". Striking the phrase was mechanical in the burial and cremation branches, but the third branch previously read "...to my Funeral Representative (if any) or, if no Funeral Representative has been designated, to my surviving family members." The assistant rewrote it as a new operative clause naming the Personal Representative "in consultation with my surviving family members" — that consultation requirement is the assistant's own drafting and changes who decides.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — operative document body

**Where:** Article VIII, Section 8.2 — Funeral and Burial Preferences, family_decides branch ({{#IF funeral_preference equals "family_decides"}})  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
I leave the decision regarding the manner of disposition of my remains (whether burial, cremation, or other lawful method) to my Personal Representative, in consultation with my surviving family members.
```

**Why it was written:** Operative legal text in the instrument, drafted by the assistant. The note said funeral and burial preferences go to the Personal Representative; it did not supply a clause. The two other branches of 8.2 were satisfied by deleting "in coordination with my Funeral Representative (if any),", but this branch had no Personal Representative to fall back on — the original read "to my Funeral Representative (if any) or, if no Funeral Representative has been designated, to my surviving family members." The assistant invented a new decision structure: the Personal Representative decides, family are consulted. Commit d21cd45.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — operative document body

**Where:** Article III (Trustee Appointment and Succession), Section — First Successor Trustee  

**Source file:** `lib/documents/templates/trust-michigan-v1.1.0.txt`

**Text:**

```text
If the Grantor is unable or unwilling to continue serving as Trustee, ceases to serve for any reason, or in the event of the Grantor's incapacity (as determined under Article [[REF:incapacity]]), I appoint {{successor_trustee.full_name}}, currently residing in {{successor_trustee.city}}, {{successor_trustee.state}}, to serve as First Successor Trustee.
```

**Why it was written:** The attorney's instruction was that the Grantor is always the initial Trustee, which collapsed the two trustee_is_self branches into one. The clause previously read "If the initial Trustee is unable or unwilling to serve..."; because "the initial Trustee" could no longer refer to a third party, the assistant rewrote the trigger as "If the Grantor is unable or unwilling to continue serving as Trustee...". This is operative succession language rewritten by the assistant.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — operative document body

**Where:** Article III (Trust Reference and Pour-Over Clause), Section 3.3 — retitled from "Failure of Trust" to "Backup Distribution"  

**Source file:** `lib/documents/templates/pour-over-will-michigan-v1.1.0.txt`

**Text:**

```text
If {{trust_name_display}} has been revoked, is otherwise invalid, or for any reason fails to take effect at the time of my passing, my residuary estate shall be distributed to the following persons in the shares indicated:

  •  {{share_percent}}% to {{full_name}}, my {{relationship}}.

If any person named in this Section does not survive me by thirty (30) days, that person's share shall be distributed proportionally among the other persons named in this Section who do survive me by thirty (30) days. If none of them survives me by thirty (30) days, my residuary estate shall pass to my heirs at law, as determined under the laws of the State of Michigan governing intestate succession, in effect at the time of my passing.
```

**Why it was written:** Uncommitted Prompt 6 work, and the most consequential self-written text in this catalogue: the clause previously sent the residuary estate straight to heirs at law if the Trust failed, and now redirects it to the client's named primary beneficiaries with a new 30-day survivorship and proportional-lapse rule. This is operative dispositive language drafted by the assistant and should not ship without attorney sign-off.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — operative document body

**Where:** Article IV, Section 4.2 — General Powers: the eight "NOT GRANTED" clauses ({{#IF dpoa_powers does_not_contain ...}})  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
□  Banking and Financial Institution Transactions.  NOT GRANTED.

The Agent is NOT authorized to conduct banking or financial institution transactions on my behalf.

□  Real Estate Transactions.  NOT GRANTED.

The Agent is NOT authorized to buy, sell, lease, mortgage, encumber, manage, or otherwise deal with any real property in which I have an interest.

□  Business Interests.  NOT GRANTED.

The Agent is NOT authorized to operate, manage, sell, or otherwise deal with any business interest of mine.

□  Tax Matters.  NOT GRANTED.

The Agent is NOT authorized to prepare, sign, or file tax returns on my behalf or to represent me before any taxing authority.

□  Insurance Transactions.  NOT GRANTED.

The Agent is NOT authorized to purchase, modify, surrender, or otherwise deal with any policy of insurance or annuity on my behalf.

□  Government Benefits.  NOT GRANTED.

The Agent is NOT authorized to apply for, receive, or manage government benefits on my behalf.

□  Retirement Accounts.  NOT GRANTED.

The Agent is NOT authorized to deal with any retirement plan or individual retirement account of mine.

□  Digital Assets.  NOT GRANTED.

The Agent is NOT authorized to access, manage, or dispose of my digital assets or digital accounts.
```

**Why it was written:** Section 4.1 promises "Each power below is GRANTED or NOT GRANTED", but only the two hot powers (gift-making, estate-plan amendment) had a declined branch; the other eight powers silently vanished from the document when a client declined them. The assistant wrote eight new negative-grant clauses to keep the promise. This is operative legal text in the instrument itself, drafted by the assistant with no attorney wording behind it.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — operative document body

**Where:** Execution page — heading and attestation sentence (replacing the former "ATTESTATION" section)  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
## EXECUTION BY THE PRINCIPAL

IN WITNESS WHEREOF, I, {{client_full_name}}, the Principal, sign my name to this Durable Power of Attorney on this _ day of _, 20_, in {{city}}, {{county}} County, Michigan.
```

**Why it was written:** The attorney's note said to delete the witness attestation. Deleting it left the heading "ATTESTATION" inaccurate and the testimonium clause ending "...in the presence of the two witnesses named below." The assistant renamed the heading to "EXECUTION BY THE PRINCIPAL" and truncated the sentence; neither the new heading nor the amended clause came from the attorney.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---


## Instruction sheets

### Last Will and Testament — instruction sheet

**Where:** Operation of This Document — opening paragraph  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
This is your Last Will and Testament under Michigan law (MCL 700.2502 et seq.). It takes effect only after you are gone. While you are living, you continue to own and control your property exactly as before, and you may revoke or amend this Will at any time while you are competent.
```

**Why it was written:** Rewritten by the assistant from the pre-existing paragraph: "This document takes effect upon your death" became "It takes effect only after you are gone", and the last two sentences were merged. The replacement phrasing is the assistant's, chosen for the house voice rule against the word "death".

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — instruction sheet

**Where:** Section A — Two Witnesses Are Required  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
In Michigan, a will requires two witnesses to be valid. This is not optional and it is not a formality: a will signed without two witnesses can be refused by the probate court, and your estate would then be distributed under the state's default rules rather than by your instructions.

Your witnesses must be adults, and they must not be people who inherit under this Will. A beneficiary who also witnesses can jeopardise their own gift. Choose two people who receive nothing under this Will.
```

**Why it was written:** The attorney's note asked that the sheet explain in plain language that Michigan requires two witnesses, why that is not a formality, and that a beneficiary who witnesses can jeopardise their own gift. The requirement was given; the wording — including the consequence stated ("can be refused by the probate court" and distribution under default rules) — was written by the assistant.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — instruction sheet

**Where:** Section B — Why There Is Also a Notary Section  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
Michigan does not require a notary for a will to be valid. The notary section in this document creates a self-proving affidavit under MCL 700.2504, which is included for stronger protection.

Here is what it does for your family. Without it, the probate court may require your witnesses to be located years later and to testify that they watched you sign. People move, lose touch, and are not always still available. A self-proving affidavit lets the court accept your Will without tracking down your witnesses, because they already swore to what they saw, in front of a notary, on the day you signed.

Signing before a notary does not replace the witness requirement. You need both: two witnesses to make the Will valid, and the notary to make it self-proving.
```

**Why it was written:** Prompt 4 removed the "SELF-PROVING AFFIDAVIT" heading from the will body per the attorney's note, leaving the notary pages unlabelled. The attorney asked that the sheet explain what the affidavit does, that without it witnesses may have to be found and testify years later, and that it does not replace the witnesses — but supplied no wording. The whole section is the assistant's.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — instruction sheet

**Where:** Section C — This Will Revokes Every Earlier Will  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
Signing this Will revokes and voids all prior wills and codicils you have made. From the moment you sign, this document is your Will and no earlier one has any effect.

If you have an older signed will in a drawer, a safe, or with another firm, destroy those copies once this one is signed, so nobody later finds an out-of-date document and mistakes it for your current wishes.
```

**Why it was written:** The attorney's note asked that the sheet say signing revokes and voids all prior wills and that older signed copies should be destroyed. Only the substance was given; the assistant wrote the section, including the reason offered for destroying them.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — instruction sheet

**Where:** Section D — How to Sign This Will (seven steps)  

**Source file:** `lib/documents/templates/will-michigan-v1.1.0.txt`

**Text:**

```text
### Section D — How to Sign This Will

STEP 1 - CHOOSE YOUR WITNESSES

Select two adult witnesses, age 18 or older. Your witnesses must NOT be named beneficiaries in this Will. Both must be present at the same time as each other and as you when signing.

STEP 2 - GATHER ALL PARTIES

Arrange for yourself, both witnesses, and a notary public to be in the same location at the same time. All parties must be physically present together throughout the signing.

STEP 3 - YOU SIGN FIRST

Sign and date this Will in the presence of both witnesses simultaneously. Do not sign before both witnesses are present. Sign on the signature line designated for the Testator.

STEP 4 - WITNESSES SIGN

Immediately after you sign, each witness signs the Will in your presence and in the presence of each other. Each witness should print their name and provide their address on the lines provided.

STEP 5 - COMPLETE THE NOTARY SECTION

You and both witnesses sign the notary section, and the notary completes and seals it. This is what makes your Will self-proving, as explained in Section B.

STEP 6 - STORE YOUR WILL SAFELY

Keep the original signed Will in a secure location such as a fireproof safe or safe deposit box, and upload a copy to your EstateVault account. Do not store the original where your Personal Representative cannot reach it without a court order.

STEP 7 - INFORM YOUR PERSONAL REPRESENTATIVE

Tell your Personal Representative that they have been named, confirm they are willing to serve, and tell them where the signed original is kept. Keep their contact details current.
```

**Why it was written:** Partly derived, partly self-written, and the self-written parts are substantial. The v1.1.0 template never carried these steps; they were lifted from the legacy Claude prompt in lib/documents/templates/michigan-will.ts and then rewritten. The heading "Section D — How to Sign This Will" is new; the legacy intro ("To make this Will legally valid under Michigan law (MCL 700.2502), you must follow each step below carefully. Failure to follow these steps may render this Will invalid.") was dropped. STEP 5 is entirely new prose replacing legacy "STEP 5 - NOTARY (OPTIONAL BUT STRONGLY RECOMMENDED)" and its paragraph; STEP 2 gained "and a notary public" and "All parties" (legacy said "yourself and both witnesses" / "All three parties"); STEP 6 swapped "or with your estate planning attorney. Inform your Executor of its location" for "and upload a copy to your EstateVault account"; STEP 7 is rewritten end to end. Every "Executor" was retargeted to "Personal Representative". Commit d21cd45.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — instruction sheet

**Where:** Instructions, Section 1 — Funding Your Trust (the explanation following the two bold sentences)  

**Source file:** `lib/documents/templates/trust-michigan-v1.1.0.txt`

**Text:**

```text
A trust controls only what it owns. Until an asset is retitled into the name of the Trust, or the Trust is named as its beneficiary, that asset is not governed by this document and does not avoid probate. Signing the Trust and funding the Trust are two separate steps, and only the first one is finished today.

The Trust Funding Instructions included in your Trust Package walk through each type of asset — bank and investment accounts, real property, business interests, insurance and retirement accounts — and tell you what to file once each transfer is done.
```

**Why it was written:** The attorney supplied only the two bold sentences ("Assets must be titled into the trust for the trust to work. We have included funding instructions to assist you."), which are excluded here as his own words. Everything after them — the explanation of why funding matters, the probate consequence, the separation of signing from funding, and the description of what the Funding Instructions cover — was written by the assistant to surround the attorney's two sentences.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — instruction sheet

**Where:** Instructions, Section 2 — Making This Document Effective  

**Source file:** `lib/documents/templates/trust-michigan-v1.1.0.txt`

**Text:**

```text
Sign and date the Trust in front of two witnesses and a notary public, and have the notary complete the notary section. Keep the signed original somewhere safe and upload a copy to your EstateVault account.
```

**Why it was written:** The rebuilt trust sheet replaced the deleted statute strip ("State of Michigan · Michigan EPIC, MCL 700.7101 et seq. / Michigan Uniform Fiduciary Access to Digital Assets Act...") with execution and revocation sections. No attorney wording was supplied for execution; written by the assistant, and it asserts a two-witness plus notary requirement for the trust that should be confirmed.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — instruction sheet

**Where:** Instructions, Section 3 — Changing or Revoking the Trust  

**Source file:** `lib/documents/templates/trust-michigan-v1.1.0.txt`

**Text:**

```text
While you have legal capacity you may amend or revoke this Trust at any time, in writing. An amendment can be prepared through your EstateVault account.
```

**Why it was written:** Added by the assistant to complete the rebuilt sheet after the statute strip was removed; the attorney's note covered only the funding statement. Also introduces a product cross-sell path (amendments through EstateVault) into a legal instrument.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — instruction sheet

**Where:** Instructions, Section 1 — This Is a Safety Net, Not a Substitute for Funding  

**Source file:** `lib/documents/templates/pour-over-will-michigan-v1.1.0.txt`

**Text:**

```text
Anything already titled in the name of your Trust passes under the Trust and never touches this Will. Anything left outside the Trust has to travel through probate before it can reach the Trust.

That is why funding matters. This Will makes sure nothing is lost; it does not make anything quick. The more you transfer into the Trust during your lifetime, the less this document ever has to do.
```

**Why it was written:** Uncommitted Prompt 6 work. Entirely assistant-written explanation of the pour-over will's relationship to trust funding and probate; no attorney wording behind it.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — instruction sheet

**Where:** Instructions, Section 2 — Two Witnesses Are Required  

**Source file:** `lib/documents/templates/pour-over-will-michigan-v1.1.0.txt`

**Text:**

```text
In Michigan, a will requires two witnesses to be valid, and a Pour-Over Will is a will. This is not a formality: signed without two witnesses, it can be refused by the probate court, and assets left outside your Trust would then pass under the state's default rules instead of into your Trust.

Your witnesses must be adults, and they must not be people who inherit under this Will or under the Trust. Choose two people who receive nothing under either document.
```

**Why it was written:** Uncommitted Prompt 6 work. Assistant-written adaptation of the will sheet's Section A to the pour-over context, extending the beneficiary-witness prohibition to Trust beneficiaries — a substantive addition that needs the attorney's confirmation.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — instruction sheet

**Where:** Instructions, Section 3 — Why There Is Also a Notary Section  

**Source file:** `lib/documents/templates/pour-over-will-michigan-v1.1.0.txt`

**Text:**

```text
Michigan does not require a notary for a will to be valid. The notary section here creates a self-proving affidavit under MCL 700.2504, included for stronger protection.

Without it, the probate court may require your witnesses to be located years later and to testify that they watched you sign. A self-proving affidavit lets the court accept this Will without tracking them down, because they already swore to what they saw in front of a notary on the day you signed.

Signing before a notary does not replace the witness requirement. You need both.
```

**Why it was written:** Uncommitted Prompt 6 work. Assistant-written, a condensed variant of the will sheet's Section B.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — instruction sheet

**Where:** Instructions, Section 4 — This Will Revokes Every Earlier Will  

**Source file:** `lib/documents/templates/pour-over-will-michigan-v1.1.0.txt`

**Text:**

```text
Signing this Will revokes and voids all prior wills and codicils you have made. If you have an older signed will elsewhere, destroy those copies once this one is signed.
```

**Why it was written:** Uncommitted Prompt 6 work. Assistant-written, a condensed variant of the will sheet's Section C.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — instruction sheet

**Where:** Operation of This Document — opening paragraph  

**Source file:** `lib/documents/templates/pour-over-will-michigan-v1.1.0.txt`

**Text:**

```text
This is your Pour-Over Will under Michigan law (MCL 700.2502 et seq.). It works alongside your {{trust_name_display}}. Its purpose is to catch anything you did not transfer into the Trust during your lifetime and direct it into the Trust, so that all of your property ends up administered and distributed under the Trust's terms.
```

**Why it was written:** Flagged for completeness: the pour-over will is being revised in the working tree (Prompt 6, not yet committed), so it is outside the commit range given but contains the same class of self-written prose. The pre-existing paragraph was rewritten by the assistant into plainer language.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — instruction sheet

**Where:** Operation of This Document — opening paragraph  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
This is your Durable Power of Attorney under the Michigan Uniform Power of Attorney Act (MCL 556.201 et seq., effective July 1, 2024). It authorizes the person you name (your Agent) to handle your financial matters. "Durable" means it remains effective if you later become unable to manage your own affairs. It does NOT authorize medical decisions, which are governed by a separate Patient Advocate Designation under MCL 700.5506. This document terminates automatically upon your passing.
```

**Why it was written:** The paragraph itself predates the work, but two phrases inside it were rewritten by the assistant in Prompt 2: "incapacitated" became "unable to manage your own affairs" (to match the new springing/immediate branch language), and "upon your death" became "upon your passing" (house voice rule). The substituted wording is the assistant's, not the attorney's.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — instruction sheet

**Where:** Section A — When Your Agent Can Act (springing branch, {{#IF dpoa_effective equals "springing"}})  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
You chose a "springing" power of attorney. Your Agent has no power to act, and cannot act, unless and until you become unable to manage your own financial affairs.

Before your Agent may do anything under this document, a licensed physician must examine you and sign a written statement saying that you are unable to manage your own financial affairs. That signed statement must be attached to this document. Until that happens, your Agent may not touch your accounts, sign for you, or act for you in any way. A bank or other institution that asks to see this document will also expect to see the physician's statement.

If you later recover, your Agent's authority stops again. It can only restart if a physician signs a new statement after your recovery.
```

**Why it was written:** The attorney's note required that a springing document explain, in plain language, that the Agent has no power until a physician certifies incapacity, that the certification must be attached, and that authority stops again on recovery — but supplied no wording for any of it. All three paragraphs are the assistant's.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — instruction sheet

**Where:** Section B — Making This Document Effective  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
Sign and date this document in front of a notary public, and have the notary complete the notary section. Michigan does not require witnesses for a power of attorney, so no witness signatures are included.

Give a signed copy to your Agent, and to any bank or institution that will be asked to accept it. Keep the signed original somewhere safe and upload a copy to your EstateVault account.
```

**Why it was written:** Prompt 2 removed the witness attestation section and both witness signature lines because Michigan requires no witnesses for a power of attorney. The attorney's note said to remove them; it did not supply text explaining to the client why the witness lines are gone or what to do instead. The assistant wrote the replacement execution instructions.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — instruction sheet

**Where:** Section C — The Agent's Acknowledgment of Duties  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
The Agent's Acknowledgment is not required to make this power of attorney effective. Your Agent's authority exists whether or not that page is ever signed.

It is included because some institutions require a signed acceptance from the Agent before they will act on the document. Having it signed in advance avoids a delay later. If you have named successor Agents, each of them can sign the acknowledgment at the time they step into the role.
```

**Why it was written:** The attorney's note directed removal of the "IMPORTANT NOTICE TO AGENT" paragraph from the top of the Acknowledgment page (which said signing was "strongly recommended Michigan practice") and asked that the explanation move to the instruction sheet. No replacement wording was supplied, so the assistant rewrote the rationale from scratch — including the new claim that the Acknowledgment is not required for effectiveness and is included only because some institutions demand it.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — instruction sheet

**Where:** Section D — Revoking This Document  

**Source file:** `lib/documents/templates/dpoa-michigan-v1.1.0.txt`

**Text:**

```text
You may revoke this power of attorney at any time while you are able to make your own decisions. Do it in writing, give the written revocation to your Agent, and notify any institution that has been relying on the document.
```

**Why it was written:** The rebuilt instruction sheet needed a revocation section to be complete alongside Sections A–C; the attorney's notes covered the effective-date branching, the witness removal and the Acknowledgment, but said nothing about revocation. Written by the assistant.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — instruction sheet

**Where:** Section A — Making This Document Effective  

**Source file:** `lib/documents/templates/pad-michigan-v1.1.0.txt`

**Text:**

```text
Michigan requires two witnesses. No notary is needed: a Patient Advocate Designation is witnessed, not notarized.

Your witnesses must both watch you sign, and then sign themselves. A witness cannot be your Patient Advocate or Successor Patient Advocate, your spouse, parent, child, grandchild or sibling, a presumptive heir or known devisee, your physician, or an employee of your insurer, of a health facility treating you, of a home for the aged where you live, or of a mental health program serving you. The full list is printed on the witness page.
```

**Why it was written:** The Round 2 attorney clarification established (as binding) that a PAD executes on two witnesses under MCL 700.5506 and carries no notary block and no self-proving affidavit. It supplied the rule, not client-facing wording. The assistant wrote this section, including the plain-language summary of the statutory disqualified-witness list.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — instruction sheet

**Where:** Section B — Your Patient Advocate Must Sign the Acceptance  

**Source file:** `lib/documents/templates/pad-michigan-v1.1.0.txt`

**Text:**

```text
Unlike most documents in your plan, this one does not work until the person you named signs. Under MCL 700.5507(5) your Patient Advocate cannot exercise any authority until they have signed the Acceptance page included here.

Give the document to your Patient Advocate and ask them to sign that page. Do the same for your Successor Patient Advocate, who signs at the time they step into the role.
```

**Why it was written:** The attorney's note required the sheet to state that the advocate's Acceptance is a legal prerequisite under MCL 700.5507(5). Only the legal point was given; the explanation, the contrast with the other documents in the plan, and the instructions to the client are the assistant's wording.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — instruction sheet

**Where:** Section C — When Your Patient Advocate Can Act  

**Source file:** `lib/documents/templates/pad-michigan-v1.1.0.txt`

**Text:**

```text
Your Patient Advocate can act only after your attending physician determines that you are unable to participate in medical treatment decisions. For mental health decisions, that determination is made separately. While you are able to take part in a decision, the decision remains yours, whatever this document says.

Authority to withhold or withdraw life-sustaining treatment applies only where you specifically granted it in this document.
```

**Why it was written:** The expanded five-section sheet required a section on when the advocate may act. No attorney wording was supplied for it; the assistant wrote the whole section, including the statement that the mental-health determination is made separately and the reassurance that the decision remains the client's while they can take part.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — instruction sheet

**Where:** Section D — Who Should Have a Copy  

**Source file:** `lib/documents/templates/pad-michigan-v1.1.0.txt`

**Text:**

```text
Give a signed copy to your Patient Advocate, your Successor Patient Advocate, and your primary care physician, and ask that a copy be added to your medical record. Keep the signed original somewhere safe and upload a copy to your EstateVault account. A copy is as useful as the original in an emergency, so a document nobody can find protects nobody.
```

**Why it was written:** The attorney's note asked that the sheet cover who should hold a copy, without supplying text. The distribution list and the closing line ("a document nobody can find protects nobody") are the assistant's.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — instruction sheet

**Where:** Section E — Revoking This Document  

**Source file:** `lib/documents/templates/pad-michigan-v1.1.0.txt`

**Text:**

```text
You may revoke this designation at any time and in any way that communicates your intent to revoke it, regardless of your mental capacity. Tell your Patient Advocate and your physician, and remove the copies you handed out.
```

**Why it was written:** The attorney's note asked that the sheet cover revocation, without supplying text. This section replaced the deleted statute strip ("State of Michigan · MCL 700.5506 et seq. · ... Michigan Uniform Anatomical Gift Act...") at the foot of the sheet. Written by the assistant.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---


## Questionnaire and interface text

### Will and Trust questionnaires — Patient Advocate step

**Where:** PadStep — question "And what about food and water given through a tube or IV?", its helper paragraph, and its five answer options (ARTIFICIAL_NUTRITION_OPTIONS)  

**Source file:** `components/intake/PoaPadSteps.tsx`

**Text:**

```text
And what about food and water given through a tube or IV?

Michigan law treats this separately from other life-sustaining treatment, so it is a separate choice.

Provide in all circumstances
Continue food and water by feeding tube or IV regardless of my condition.

Stop if I have a terminal condition
An incurable condition with no reasonable likelihood of recovery.

Stop if I am permanently unconscious
A persistent vegetative state, with no awareness of myself or my surroundings.

Stop if either applies
A terminal condition or permanent unconsciousness.

Leave the decision to my patient advocate
No set preference; your advocate decides in your best interest.
```

**Why it was written:** Asked separately from life-sustaining treatment because Michigan treats artificial nutrition and hydration separately; the assistant made that call and wrote the question, the explanatory line asserting the legal position, and all five labels and descriptions. Values map 1:1 to the {{#IF artificial_nutrition_preference ...}} branches in the PAD template. Marked "PENDING ATTORNEY APPROVAL" in the code.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Will and Trust questionnaires — Patient Advocate step

**Where:** PadStep — question "If you could not recover, what should happen to life-sustaining treatment?", its helper paragraph, and its five answer options (LIFE_SUSTAINING_OPTIONS)  

**Source file:** `components/intake/PoaPadSteps.tsx`

**Text:**

```text
If you could not recover, what should happen to life-sustaining treatment?

Life-sustaining treatment means things like a breathing machine or CPR. Your advocate can only act on this if a physician has determined you cannot take part in the decision yourself.

Continue all treatment
Keep all life-sustaining treatment going in every circumstance.

Stop if I have a terminal condition
An incurable condition with no reasonable likelihood of recovery.

Stop if I am permanently unconscious
A persistent vegetative state, with no awareness of myself or my surroundings.

Stop if either applies
A terminal condition or permanent unconsciousness.

Leave the decision to my patient advocate
No set preference; your advocate decides in your best interest.
```

**Why it was written:** Article V of the PAD template had {{#IF life_sustaining_treatment_preference ...}} branches but no question fed them, so the section rendered blank and strict validation blocked every PAD. The assistant wrote the question, the explanatory paragraph, and all five labels and descriptions — including the lay definitions of "terminal condition" and "persistent vegetative state", which determine which operative branch prints in the client's healthcare document. Marked "PENDING ATTORNEY APPROVAL" in the code.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Will and Trust questionnaires — Power of Attorney step

**Where:** PoaStep — question "When should your agent be able to act?" and its two answer options (POA_EFFECTIVE_OPTIONS)  

**Source file:** `components/intake/PoaPadSteps.tsx`

**Text:**

```text
When should your agent be able to act?

Immediately, as soon as I sign
Your agent can act on your behalf right away, even while you are managing your own affairs.

Only if I become unable to manage my own affairs
Your agent has no authority unless and until a physician certifies in writing that you cannot manage your finances.
```

**Why it was written:** Article III of the DPOA template already carried both effective-date branches but nothing in the intake let a client choose between them, so the document could not render. The assistant wrote the question and both option labels and descriptions; the values map 1:1 to the {{#IF dpoa_effective ...}} branches. The code marks the block "PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney."

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Will and Trust questionnaires — final review screen

**Where:** Review screen — new summary row labels in the Power of Attorney and Healthcare Directive sections  

**Source file:** `app/will/page.tsx and app/trust/page.tsx`

**Text:**

```text
Takes effect

Life-sustaining treatment

Food and water by tube
```

**Why it was written:** Labels invented by the assistant to display the three new answers back to the client on the review screen. "Food and water by tube" in particular is the assistant's lay rendering of artificial nutrition and hydration and should match whatever term the attorney approves for the question itself.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Will and Trust questionnaires — final review screen

**Where:** Review screen — resume notice shown when a saved session is routed back for newly added questions  

**Source file:** `app/will/page.tsx and app/trust/page.tsx`

**Text:**

```text
We've added a question since you started. Your existing answers have been kept, so you only need to complete this one to continue.

(plural form) We've added a few questions since you started. Your existing answers have been kept, so you only need to complete these to continue.
```

**Why it was written:** Prompt 3B and the browser-walkthrough commit route a session saved before the POA/PAD questions existed back to the step that asks them. Nothing in the attorney's notes covers what to tell the client when this happens; the assistant wrote the notice, and it is client-facing copy that appears mid-flow in a paid legal-document purchase. The same text is duplicated in both files.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---


## Legacy pdf-lib instruction sheets (shared, `lib/documents/instruction-sheets.ts`)

### All five documents — legacy pdf-lib instruction sheet

**Where:** CLOSING_BLOCKS — heading "Important Notice"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
EstateVault provides document preparation services only. This is not legal advice, and no attorney-client relationship is created. If you have questions about how this document applies to your circumstances, a licensed attorney can assist you.
```

**Why it was written:** Self-written disclaimer appended to all five instruction sheets. It is the assistant's phrasing of the platform's no-legal-advice position and appears on every generated document, so the exact wording is a legal exposure point the attorney should approve.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### All five documents — legacy pdf-lib instruction sheet

**Where:** CLOSING_BLOCKS — heading "Storing and Updating This Document"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Keep the signed original in a safe, accessible place, and tell the people named in it where that place is. A copy of every document in your plan is stored in your EstateVault account.

Review your plan after any significant change in your family, your assets, or the people you have named. An amendment can be prepared through your EstateVault account.
```

**Why it was written:** lib/documents/instruction-sheets.ts was created whole by the assistant when the "Operation of This Document" sheet was introduced; the attorney's note asked for an instruction sheet but supplied no copy for it. This closing block is appended to every one of the five sheets. The file header itself still reads "Attorney Approval Date: [TO BE FILLED] / Approved By: [TO BE FILLED]".

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — legacy pdf-lib instruction sheet

**Where:** SHEETS.poa — heading "Making This Document Effective" (five steps)  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Read the entire document before signing anything.

Sign and date the document in the presence of a notary public.

The notary completes and seals the notary section.

Give a signed copy to your Agent, and to any bank or institution that will be asked to accept it.

Store the signed original and upload a copy to your EstateVault account.
```

**Why it was written:** Assistant-written execution steps for the legacy renderer. These steps say nothing about the springing/immediate distinction added in Prompt 2 or about the Agent's Acknowledgment page, so they are now incomplete relative to the v1.1.0 document.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — legacy pdf-lib instruction sheet

**Where:** SHEETS.poa — heading "Revoking This Document"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
You may revoke this power of attorney at any time by giving written notice to your Agent, and by notifying any institution that has been relying on it.
```

**Why it was written:** Written by the assistant. Note it omits the capacity condition the assistant later wrote into the v1.1.0 sheet ("at any time while you are able to make your own decisions"), so the two versions state the revocation rule differently.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Durable Power of Attorney — legacy pdf-lib instruction sheet

**Where:** SHEETS.poa — heading "What This Document Does"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Your Durable Power of Attorney authorizes the Agent you named to handle financial and property matters on your behalf. It is durable, which means it remains in force if you later become unable to manage your own affairs.
```

**Why it was written:** Written by the assistant; no attorney wording existed for a plain-language summary of the DPOA.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — legacy pdf-lib instruction sheet

**Where:** SHEETS.will — heading "Making This Document Effective" (paragraph plus seven steps)  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
In Michigan, a will requires two witnesses to be valid. A notary section is also included so the will can be self-proved.

Read the entire document before signing anything.

Gather two adult witnesses who are not named as beneficiaries in this will, and a notary public.

You, both witnesses, and the notary must all be together in the same place at the same time.

Sign and date the will in the presence of both witnesses.

Each witness then signs and prints their name and address in your presence.

You and both witnesses sign the notary section, and the notary completes and seals it.

Store the signed original and upload a copy to your EstateVault account.
```

**Why it was written:** The assistant's own condensed rewrite of the signing procedure for the legacy pdf-lib renderer, written independently of the seven-step legacy prompt text and of the v1.1.0 template sheet. It is a second, differently worded set of execution instructions for the same document, so the attorney should check the two do not conflict.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Last Will and Testament — legacy pdf-lib instruction sheet

**Where:** SHEETS.will — heading "What This Document Does"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Your Last Will and Testament directs how your property is distributed, names the Personal Representative who will carry out those directions, and, if you have named one, appoints a guardian for your minor children.
```

**Why it was written:** Written by the assistant when the instruction-sheet mechanism was built; no attorney text existed for a plain-language summary of the will.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — legacy pdf-lib instruction sheet

**Where:** SHEETS.healthcare_directive — heading "Making This Document Effective" (paragraph plus seven steps)  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Michigan requires two witnesses. A witness cannot be your patient advocate or successor advocate, your spouse, parent, child, grandchild or sibling, a presumptive heir, or an employee of a facility where you are receiving care.

Read the entire document before signing anything.

Gather two adult witnesses who meet the requirements above.

Sign and date the designation in the presence of both witnesses.

Each witness then signs and prints their name and address in your presence.

Your patient advocate signs the acceptance page. The designation gives your advocate no authority until that acceptance is signed.

Give a signed copy to your patient advocate, your successor advocate, and your primary care physician.

Store the signed original and upload a copy to your EstateVault account.
```

**Why it was written:** Assistant-written. The disqualified-witness list here is an abridged version of the statutory list and differs from the fuller list the assistant later wrote for the v1.1.0 PAD sheet (which adds "known devisee", "your physician", insurer employees, homes for the aged and mental health programs). Both are the assistant's paraphrase of the statute, not the attorney's text.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — legacy pdf-lib instruction sheet

**Where:** SHEETS.healthcare_directive — heading "What This Document Does"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Your Patient Advocate Designation names the person who will make medical and care decisions for you if you become unable to participate in those decisions yourself, and records your wishes about the care you want to receive.
```

**Why it was written:** Written by the assistant; no attorney wording existed for a plain-language summary of the PAD.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Patient Advocate Designation — legacy pdf-lib instruction sheet

**Where:** SHEETS.healthcare_directive — heading "When Your Advocate May Act"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Your patient advocate may act only after your attending physician and one other physician have examined you and determined that you are unable to participate in medical treatment decisions. Authority to withhold or withdraw life-sustaining treatment applies only if you specifically granted it in this document.
```

**Why it was written:** Assistant-written, and it states a two-physician requirement that contradicts the assistant's own v1.1.0 PAD instruction sheet and the PAD template body, both of which say the attending physician alone makes the determination. The attorney needs to settle which is correct.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — legacy pdf-lib instruction sheet

**Where:** SHEETS.pour_over_will — heading "This Document Works With Your Trust"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
The Pour-Over Will is a safety net, not a substitute for funding your trust. Assets that pass through this will must still go through probate before reaching the trust.
```

**Why it was written:** Written by the assistant. It states a probate consequence to the client with no attorney-supplied wording behind it.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Pour-Over Will — legacy pdf-lib instruction sheet

**Where:** SHEETS.pour_over_will — heading "What This Document Does"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Your Pour-Over Will is the companion to your Revocable Living Trust. Any asset that was not transferred into the trust during your lifetime is directed into the trust, so that it is administered and distributed under the trust's terms.
```

**Why it was written:** Written by the assistant; no attorney wording existed for a plain-language summary of the pour-over will.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — legacy pdf-lib instruction sheet

**Where:** SHEETS.trust — heading "Funding the Trust"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Assets must be titled into the trust for the trust to work. Funding instructions are included in your Trust Package to assist you with this.

A trust that holds nothing, or holds only part of what you own, does not control the assets left outside of it. Work through the funding instructions asset by asset, and keep proof of each transfer in your Vault.
```

**Why it was written:** The first sentence is the attorney's, but the second sentence of the bold block is an assistant rewrite of his "We have included funding instructions to assist you." — so the bold paragraph as printed here is not his verbatim wording, and it differs from the version used in the v1.1.0 trust template. The following paragraph is entirely the assistant's.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — legacy pdf-lib instruction sheet

**Where:** SHEETS.trust — heading "Making This Document Effective" (four steps)  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Read the entire document before signing anything.

Sign and date the trust in the presence of a notary public.

The notary completes and seals the notary section.

Store the signed original and upload a copy to your EstateVault account.
```

**Why it was written:** Assistant-written execution steps for the legacy renderer. Note these steps require only a notary, whereas the v1.1.0 trust instruction sheet the assistant later wrote requires "two witnesses and a notary public" — the discrepancy needs the attorney's ruling.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---

### Revocable Living Trust — legacy pdf-lib instruction sheet

**Where:** SHEETS.trust — heading "What This Document Does"  

**Source file:** `lib/documents/instruction-sheets.ts`

**Text:**

```text
Your Revocable Living Trust holds title to the assets you transfer into it, states who manages those assets, and directs how they are distributed. You may amend or revoke it at any time while you are living and able to do so.
```

**Why it was written:** Written by the assistant; no attorney wording existed for a plain-language summary of the trust.

**Decision:** ☐ approved as written ☐ replace with attorney wording

---
