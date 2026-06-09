const template = `
PATIENT ADVOCATE

DESIGNATION

MEDICAL & MENTAL HEALTH AUTHORITY

OF

{{client_full_name_upper}}

Patient: {{client_full_name}}  ·  Date of Birth: {{client_dob}}

Residence: {{street_address}}, {{city}}, {{county}} County, Michigan  {{zip}}

Patient Advocate: {{patient_advocate.full_name}}  ·  {{patient_advocate.relationship}}

Successor Patient Advocate: {{successor_patient_advocate.full_name}}  ·  {{successor_patient_advocate.relationship}}

## OPERATION OF THIS DOCUMENT

This is your Patient Advocate Designation under Michigan law (MCL 700.5506 et seq.). It authorizes the person you name (your Patient Advocate) to make medical and mental health decisions on your behalf when you are unable to participate in those decisions yourself. This document becomes effective ONLY when your attending physician determines you are unable to participate in those decisions. While you can participate, you continue to make your own medical decisions. You may revoke this document at any time, regardless of your mental capacity.

State of Michigan  ·  MCL 700.5506 et seq.  ·  Michigan Mental Health Code, MCL 330.1404

Federal HIPAA, 45 C.F.R. Part 164  ·  Michigan Uniform Anatomical Gift Act, MCL 333.10101 et seq.

{{#IF attorney_review_purchased}}

## ATTORNEY REVIEWED & APPROVED

Reviewing Attorney: {{reviewing_attorney_name}}  ·  Bar No. {{reviewing_attorney_bar_number}}

Firm: {{reviewing_attorney_firm}}  ·  Reviewed: {{review_date}}

{{/IF}}

## IMPORTANT INFORMATION FOR THE PATIENT

Read this document carefully before signing. By signing, you are designating another person to make life-and-death medical decisions on your behalf if you cannot make them yourself. Note: in some states this role is called a "healthcare power of attorney" or "healthcare proxy." In Michigan, the official term is "patient advocate." If you do not understand any provision, consult an attorney or a healthcare professional before signing.

## ARTICLE I — DESIGNATION OF PATIENT

### Section 1.1 — Patient.

I, {{client_full_name}}, a resident of {{city}}, {{county}} County, Michigan, with a residence address of {{street_address}}, {{city}}, Michigan {{zip}} (the "Patient"), do hereby make this Patient Advocate Designation under the Michigan Patient Advocate Designation statute, MCL 700.5506 et seq.

### Section 1.2 — Statement of Capacity.

I am eighteen (18) years of age or older and of sound mind. I am executing this Patient Advocate Designation voluntarily, free from duress, fraud, and undue influence.

## ARTICLE II — DESIGNATION OF PATIENT ADVOCATE

### Section 2.1 — Patient Advocate.

I designate {{patient_advocate.full_name}}, currently residing in {{patient_advocate.city}}, {{patient_advocate.state}}, with a contact telephone number of {{patient_advocate.phone}} (the "Patient Advocate"), as my Patient Advocate to make medical and mental health treatment decisions on my behalf when I am unable to participate in those decisions. The Patient Advocate is my {{patient_advocate.relationship}}.

### Section 2.2 — Successor Patient Advocate.

If {{patient_advocate.full_name}} is unable or unwilling to serve as my Patient Advocate, dies, resigns, becomes incapacitated, or for any other reason ceases to serve, I designate {{successor_patient_advocate.full_name}}, currently residing in {{successor_patient_advocate.city}}, {{successor_patient_advocate.state}}, with a contact telephone number of {{successor_patient_advocate.phone}}, as my Successor Patient Advocate. The Successor Patient Advocate is my {{successor_patient_advocate.relationship}}.

### Section 2.3 — Authority of Successor.

The Successor Patient Advocate shall have all of the same powers and authority granted to the Patient Advocate under this designation. References in this document to "the Patient Advocate" shall include the Successor Patient Advocate duly serving in that capacity.

## ARTICLE III — EFFECTIVE DATE

### Section 3.1 — When Effective.

This Patient Advocate Designation is not effective unless and until my attending physician determines that I am unable to participate in decisions regarding my medical or mental health treatment, as applicable. This requirement is established by MCL 700.5508.

### Section 3.2 — Determination of Inability to Participate.

My attending physician shall make the determination of my inability to participate based on the physician's medical judgment, examination, and review of my medical condition. The physician shall record the determination in my medical record. For decisions regarding mental health treatment, an additional determination by a mental health professional may be required as provided in Michigan law.

### Section 3.3 — Restoration of Capacity.

If I subsequently regain the ability to participate in decisions regarding my medical or mental health treatment, my Patient Advocate's authority is suspended for the duration of my restored capacity. The Patient Advocate's authority shall again become effective upon a new physician determination of inability to participate.

## ARTICLE IV — AUTHORITY GRANTED TO PATIENT ADVOCATE

### Section 4.1 — General Authority.

I grant my Patient Advocate the authority to make decisions regarding my care, custody, and medical and mental health treatment in accordance with the provisions of this designation and Michigan law. The Patient Advocate shall act in my best interest and in accordance with my reasonable expectations to the extent actually known by the Patient Advocate, and shall consider the statements of my desires set forth in this designation.

### Section 4.2 — Statutory Limitation on Authority.

Pursuant to MCL 700.5507(2), the Patient Advocate shall not exercise powers concerning my care, custody, and medical or mental health treatment that I, if I were able to participate in the decision, could not have exercised on my own behalf.

### Section 4.3 — Specific Authority.

The Patient Advocate is authorized to: receive medical information and consult with my healthcare providers regarding my condition, treatment options, and prognosis; consent to or refuse consent to any medical examination, test, procedure, surgery, or treatment; authorize my admission to or discharge from any hospital, nursing facility, hospice, or other healthcare institution; make decisions regarding the use, withdrawal, or withholding of life-sustaining treatment, subject to the express preferences set forth in Article V of this designation and subject to the statutory restrictions set forth in Article VI; make decisions regarding pain management, palliative care, and comfort care; authorize or refuse the use of artificial nutrition and hydration, subject to the express preferences set forth in Article V; and take any other action necessary or appropriate to give effect to my medical and mental health treatment decisions.

### Section 4.4 — HIPAA Authorization.

Pursuant to the federal Health Insurance Portability and Accountability Act of 1996 (HIPAA), 45 C.F.R. § 160 et seq., I expressly authorize my Patient Advocate to receive all of my protected health information from any healthcare provider, insurer, or other covered entity. This authorization is given to enable the Patient Advocate to make informed medical and mental health decisions on my behalf. The Patient Advocate may execute any HIPAA-required forms on my behalf to facilitate the disclosure of my protected health information.

{{#IF hipaa_additional_authorized_parties_not_empty}}

### Section 4.5 — Additional HIPAA Authorized Parties.

In addition to my Patient Advocate, I authorize the following individuals to receive my protected health information from any healthcare provider, insurer, or other covered entity:

{{#FOREACH hipaa_additional_authorized_parties}}

  •  {{full_name}}, my {{relationship}}.

{{/FOREACH}}

The individuals listed above do not have authority to make medical or mental health treatment decisions on my behalf; that authority is reserved to my Patient Advocate.

{{/IF}}

### Section 4.6 — Mental Health Treatment Authority.

{{#IF mental_health_treatment_authority equals true}}

■  Mental Health Treatment Authority.  GRANTED.

Pursuant to MCL 330.1404, I specifically and expressly grant my Patient Advocate the authority to consent to mental health treatment on my behalf, including but not limited to: voluntary admission to a hospital or psychiatric facility for mental health treatment; outpatient mental health treatment, including therapy and counseling; the administration of psychotropic medications prescribed by a treating physician or psychiatrist; electroconvulsive therapy (ECT), subject to applicable state and federal law and the additional protections of MCL 330.1717; and any other mental health treatment recommended by a treating mental health professional. I understand that my Patient Advocate cannot order me to be involuntarily hospitalized except through the formal civil commitment process set forth in the Michigan Mental Health Code.

{{/IF}}

{{#IF mental_health_treatment_authority equals false}}

□  Mental Health Treatment Authority.  NOT GRANTED.

I do NOT grant my Patient Advocate the authority to consent to mental health treatment on my behalf, including hospitalization. Decisions regarding mental health treatment shall require separate authorization through applicable Michigan law.

{{/IF}}

## ARTICLE V — STATEMENT OF DESIRES REGARDING MEDICAL TREATMENT

### Section 5.1 — Life-Sustaining Treatment.

This Section sets forth my preferences regarding the use of life-sustaining treatment. "Life-sustaining treatment" includes mechanical ventilation, cardiopulmonary resuscitation (CPR), dialysis, surgical interventions, blood transfusions, and other interventions that may extend my life.

{{#IF life_sustaining_treatment_preference equals "continue_all"}}

MY ELECTED PREFERENCE  ·  Continue All Life-Sustaining Treatment.

I desire that all reasonable measures be taken to extend my life, regardless of my medical condition. My Patient Advocate shall authorize the continued use of life-sustaining treatment to the extent medically appropriate.

{{/IF}}

{{#IF life_sustaining_treatment_preference equals "withhold_if_terminal"}}

MY ELECTED PREFERENCE  ·  Withhold if Terminal Condition.

A terminal condition is an incurable condition from which there is no reasonable likelihood of recovery and which is expected to result in death within a relatively short time. If I have a terminal condition, I direct that my Patient Advocate authorize the withholding or withdrawal of life-sustaining treatment, and that I be permitted to die naturally with only the administration of medication, food, water (subject to Section 5.2), and procedures necessary to provide comfort and dignity.

{{/IF}}

{{#IF life_sustaining_treatment_preference equals "withhold_if_pvs"}}

MY ELECTED PREFERENCE  ·  Withhold if Persistent Vegetative State.

A persistent vegetative state is a condition of permanent unconsciousness with no awareness of self or environment. If I am in a persistent vegetative state, I direct that my Patient Advocate authorize the withholding or withdrawal of life-sustaining treatment, and that I be permitted to die naturally with only the administration of medication, food, water (subject to Section 5.2), and procedures necessary to provide comfort and dignity.

{{/IF}}

{{#IF life_sustaining_treatment_preference equals "withhold_if_terminal_or_pvs"}}

MY ELECTED PREFERENCE  ·  Withhold if Terminal Condition or Persistent Vegetative State.

A terminal condition is an incurable condition from which there is no reasonable likelihood of recovery and which is expected to result in death within a relatively short time. A persistent vegetative state is a condition of permanent unconsciousness with no awareness of self or environment. If I have a terminal condition OR if I am in a persistent vegetative state, I direct that my Patient Advocate authorize the withholding or withdrawal of life-sustaining treatment, and that I be permitted to die naturally with only the administration of medication, food, water (subject to Section 5.2), and procedures necessary to provide comfort and dignity.

{{/IF}}

{{#IF life_sustaining_treatment_preference equals "advocate_decides"}}

MY ELECTED PREFERENCE  ·  Decision Left to My Patient Advocate.

I do not set forth a specific preference regarding life-sustaining treatment. I trust my Patient Advocate to make decisions regarding life-sustaining treatment in accordance with the standards set forth in Article IV and based on the Patient Advocate's good-faith assessment of my best interest.

{{/IF}}

### Section 5.2 — Artificial Nutrition and Hydration.

Under Michigan law, decisions regarding artificial nutrition and hydration (the provision of food and water through a feeding tube, intravenous line, or similar means) are addressed separately from other life-sustaining treatment.

{{#IF artificial_nutrition_preference equals "provide_all"}}

MY ELECTED PREFERENCE  ·  Provide in All Circumstances.

I direct that artificial nutrition and hydration be provided regardless of my medical condition. My Patient Advocate shall authorize the continued provision of artificial nutrition and hydration.

{{/IF}}

{{#IF artificial_nutrition_preference equals "withhold_if_terminal"}}

MY ELECTED PREFERENCE  ·  Withhold if Terminal Condition.

If I have a terminal condition (as defined in Section 5.1), I direct that my Patient Advocate authorize the withholding or withdrawal of artificial nutrition and hydration.

{{/IF}}

{{#IF artificial_nutrition_preference equals "withhold_if_pvs"}}

MY ELECTED PREFERENCE  ·  Withhold if Persistent Vegetative State.

If I am in a persistent vegetative state (as defined in Section 5.1), I direct that my Patient Advocate authorize the withholding or withdrawal of artificial nutrition and hydration.

{{/IF}}

{{#IF artificial_nutrition_preference equals "withhold_if_terminal_or_pvs"}}

MY ELECTED PREFERENCE  ·  Withhold if Terminal Condition or Persistent Vegetative State.

If I have a terminal condition OR if I am in a persistent vegetative state (as defined in Section 5.1), I direct that my Patient Advocate authorize the withholding or withdrawal of artificial nutrition and hydration.

{{/IF}}

{{#IF artificial_nutrition_preference equals "advocate_decides"}}

MY ELECTED PREFERENCE  ·  Decision Left to My Patient Advocate.

I do not set forth a specific preference regarding artificial nutrition and hydration. I trust my Patient Advocate to make decisions regarding artificial nutrition and hydration in accordance with the standards set forth in Article IV.

{{/IF}}

### Section 5.3 — Pain Management and Comfort Care.

{{#IF pain_management_preference equals "provide_even_if_shortens"}}

MY ELECTED PREFERENCE  ·  Provide Pain Relief Even if Life-Shortening.

I direct that adequate pain medication and palliative care be administered to relieve pain and suffering, even if such medication or care may have the effect of shortening my life. The relief of pain is more important to me than the possible incidental shortening of life that may result from adequate pain management.

{{/IF}}

{{#IF pain_management_preference equals "standard_relief"}}

MY ELECTED PREFERENCE  ·  Standard Pain Relief.

I direct that pain medication be administered in amounts consistent with standard medical practice and consistent with my underlying medical condition.

{{/IF}}

### Section 5.4 — Organ and Tissue Donation.

{{#IF organ_donation equals "yes_all"}}

I authorize the donation of any of my organs, tissues, eyes, or other body parts that may be useful for the purposes of transplantation, therapy, research, or education. Pursuant to MCL 700.5506(1)(b), I expressly authorize my Patient Advocate to make an anatomical gift on my behalf under Michigan's Uniform Anatomical Gift Act, MCL 333.10101 et seq. This authority remains exercisable after my death.

{{/IF}}

{{#IF organ_donation equals "yes_specific"}}

I authorize the donation of my organs, tissues, eyes, or other body parts for the following specific purposes only: {{organ_donation_purposes_joined}}. No donation shall be made for any purpose not listed above. I expressly authorize my Patient Advocate to make an anatomical gift on my behalf under Michigan's Uniform Anatomical Gift Act, MCL 333.10101 et seq., subject to this restriction. This authority remains exercisable after my death.

{{/IF}}

{{#IF organ_donation equals "no"}}

I do NOT authorize the donation of any of my organs, tissues, or body parts. My Patient Advocate is not authorized to make any anatomical gift on my behalf.

{{/IF}}

{{#IF organ_donation equals "advocate_decides"}}

I leave the decision regarding organ, tissue, and body part donation to my Patient Advocate or, if my Patient Advocate is unavailable, to my surviving family members in accordance with the priorities established under Michigan's Uniform Anatomical Gift Act, MCL 333.10101 et seq. My Patient Advocate may make an anatomical gift on my behalf under MCL 700.5506(1)(b).

{{/IF}}

## ARTICLE VI — PREGNANCY EXCLUSION

### Section 6.1 — Statutory Floor (Cannot Be Waived).

Pursuant to MCL 700.5512(1), my Patient Advocate cannot make a medical treatment decision under this Patient Advocate Designation to withhold or withdraw treatment from me if I am pregnant where such withholding or withdrawal would result in my death. This statutory restriction operates regardless of any preference I have stated in this designation and cannot be waived.

### Section 6.2 — My Additional Preference.

{{#IF pregnancy_exclusion equals "no_pregnancy_restriction"}}

MY ELECTED PREFERENCE  ·  No Additional Pregnancy Restriction.

Subject to the statutory floor set forth in Section 6.1, my Patient Advocate may make any decision authorized under this designation regardless of my pregnancy. Aside from the prohibition on withholding or withdrawing treatment that would result in my death while pregnant, my pregnancy shall not affect the decisions my Patient Advocate may make on my behalf.

{{/IF}}

{{#IF pregnancy_exclusion equals "pregnancy_restriction"}}

MY ELECTED PREFERENCE  ·  Additional Pregnancy Restriction.

In addition to the statutory floor set forth in Section 6.1, I direct that my Patient Advocate shall not authorize the withholding or withdrawal of any life-sustaining treatment if I am pregnant and the treatment is intended or reasonably expected to allow the pregnancy to continue. This restriction is in addition to the statutory restriction.

{{/IF}}

## ARTICLE VII — PATIENT ADVOCATE'S DUTIES

### Section 7.1 — Statutory Duties.

The Patient Advocate's duties are set forth in MCL 700.5511 and other applicable provisions of Michigan law and are incorporated into this designation by reference. These duties include: the duty to act in good faith; the duty to act in accordance with my reasonable expectations to the extent actually known by the Patient Advocate; the duty to act in my best interest; the duty to follow the directives set forth in this designation to the extent applicable to the decision before the Patient Advocate; the duty to consult with my healthcare providers regarding my condition and treatment; the duty to consider the recommendations of my healthcare providers; and the duty to not make decisions that exceed the authority granted in this designation or that are prohibited by Michigan law.

### Section 7.2 — Standard of Care.

The Patient Advocate shall make decisions with the care, competence, and diligence ordinarily exercised by patient advocates in similar circumstances. The Patient Advocate shall not be liable for actions taken in good faith and in the exercise of reasonable judgment, pursuant to the immunity provisions of MCL 700.5510.

### Section 7.3 — Records.

The Patient Advocate shall keep contemporaneous records of significant medical and mental health decisions made on my behalf, including the date of each decision, the nature of the decision, the medical advice received, and the basis for the decision.

## ARTICLE VIII — REVOCATION

### Section 8.1 — Revocation of Designation.

Pursuant to MCL 700.5509, I may revoke this Patient Advocate Designation at any time, regardless of my mental capacity, by any of the following methods: destroying the original Patient Advocate Designation with the intent to revoke it; providing oral or written notice of revocation to my Patient Advocate, to my attending physician, or to a member of the medical staff treating me; executing a new Patient Advocate Designation that revokes this one; or engaging in any other action that demonstrates an intent to revoke this designation.

### Section 8.2 — Revocation by Marriage Termination.

If my spouse is named as Patient Advocate in this designation and our marriage is terminated by divorce, annulment, or court order, my spouse's designation as Patient Advocate is automatically revoked unless this document specifically states otherwise. The next designated Successor Patient Advocate shall serve as Patient Advocate.

## ARTICLE IX — GENERAL PROVISIONS

### Section 9.1 — Healthcare Provider Reliance.

Healthcare providers are entitled to rely on this Patient Advocate Designation when presented in good faith. Pursuant to MCL 700.5510, healthcare providers who act in good faith in reliance on this designation and on the directions of my Patient Advocate are immune from civil and criminal liability for such reliance.

### Section 9.2 — Healthcare Provider Cannot Require Designation.

Pursuant to MCL 700.5512(2), no healthcare provider may require the execution of a Patient Advocate Designation as a condition of providing, withholding, or withdrawing care, custody, or medical or mental health treatment.

### Section 9.3 — Severability.

If any provision of this Patient Advocate Designation is held to be invalid, unenforceable, or contrary to law, the remaining provisions shall continue in full force and effect.

### Section 9.4 — Governing Law.

This Patient Advocate Designation shall be governed by and construed in accordance with the laws of the State of Michigan, including MCL 700.5506 et seq.

## PATIENT EXECUTION

IN WITNESS WHEREOF, I, {{client_full_name}}, the Patient, sign my name to this Patient Advocate Designation on this _ day of ___, 20_, in {{city}}, {{county}} County, Michigan, voluntarily and free from duress, fraud, and undue influence.

[SIGNATURE] Patient — Signature and Date

## WITNESS ATTESTATION

Per MCL 700.5506(4) — Witness qualifications are strict and verifiable

## CRITICAL NOTICE TO WITNESSES  ·  MCL 700.5506(4)

A witness to this Patient Advocate Designation CANNOT be any of the following: the Patient's spouse, parent, child, grandchild, or sibling; a presumptive heir of the Patient; a known devisee of the Patient at the time of witnessing; the Patient's physician; the Patient Advocate or Successor Patient Advocate; an employee of a life or health insurance provider for the Patient; an employee of a health facility treating the Patient; an employee of a home for the aged where the Patient resides; or an employee of a community mental health services program or hospital providing mental health services to the Patient. A witness shall not sign this designation unless the Patient appears to be of sound mind and under no duress, fraud, or undue influence.

The undersigned witnesses, having read the above notice, hereby attest that we are NOT disqualified from serving as witnesses under MCL 700.5506(4), and that the Patient appeared to be of sound mind and under no duress, fraud, or undue influence when the Patient signed this designation in our presence.

[SIGNATURE] Witness One — Signature, Printed Name, and Address

[SIGNATURE] Witness Two — Signature, Printed Name, and Address

## ACCEPTANCE BY PATIENT ADVOCATE

Pursuant to MCL 700.5507(5) — Required before exercising authority

## IMPORTANT NOTICE TO PATIENT ADVOCATE

Under Michigan law, you cannot exercise authority under this Patient Advocate Designation until you have signed this Acceptance. Please read each statement carefully before signing.

I, the undersigned Patient Advocate, acknowledge and accept appointment as Patient Advocate under the foregoing Patient Advocate Designation. By signing below, I confirm that I have read and understood this designation and that I acknowledge each of the following statements as required by MCL 700.5507(5):

(1)  This Patient Advocate Designation is not effective unless the Patient is unable to participate in decisions regarding the Patient's medical or mental health, as applicable.

(2)  A Patient Advocate shall not exercise powers concerning the Patient's care, custody, and medical or mental health treatment that the Patient, if the Patient were able to participate in the decision, could not have exercised on the Patient's own behalf.

(3)  This Patient Advocate Designation cannot be used to make a medical treatment decision to withhold or withdraw treatment from a Patient who is pregnant that would result in the pregnant Patient's death.

(4)  A Patient Advocate may make a decision to withhold or withdraw treatment that would allow the Patient to die only if the Patient has expressed in a clear and convincing manner that the Patient Advocate is authorized to make such a decision, and that the Patient acknowledges that such a decision could or would allow the Patient's death.

(5)  A Patient Advocate shall not receive compensation for the performance of the Patient Advocate's authority, rights, and responsibilities, but may be reimbursed for actual and necessary expenses incurred in the performance of those duties.

(6)  A Patient Advocate shall act in accordance with the standards of care applicable to fiduciaries when acting under the Patient Advocate Designation, in accordance with the Patient's best interest, and consistent with the Patient's directions as set forth in this designation.

(7)  A Patient Advocate may choose to revoke acceptance of the appointment as Patient Advocate by giving written notice to the Patient, to the Patient's healthcare provider, or to a family member of the Patient.

Primary Patient Advocate: {{patient_advocate.full_name}}

[SIGNATURE] Primary Patient Advocate — Signature and Date

Successor Patient Advocate (sign when assuming role): {{successor_patient_advocate.full_name}}

[SIGNATURE] Successor Patient Advocate — Signature and Date
`;

export default template;
