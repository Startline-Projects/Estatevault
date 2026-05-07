// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

import { writeFileSync } from "fs";
import { join } from "path";
import { generatePDF } from "../lib/documents/generate-pdf";

const TESTATOR = "John Smith";
const SIGN_DATE = "March 15, 2024";

const willText = `LAST WILL AND TESTAMENT OF JOHN SMITH

I, JOHN SMITH, a resident of Detroit, Michigan, being of sound mind and memory, do hereby declare this to be my Last Will and Testament, revoking all prior wills and codicils.

ARTICLE I - FAMILY IDENTIFICATION

I am married to Jane Smith. We have two (2) children, namely Emma Smith and Liam Smith. All references to "my children" in this Will shall include any children later born to or legally adopted by me.

ARTICLE II - PAYMENT OF DEBTS AND EXPENSES

I direct my Executor to pay all of my legally enforceable debts, funeral and burial expenses, and the expenses of administration of my estate as soon as practicable after my passing, from the residue of my estate.

ARTICLE III - RESIDUARY ESTATE

I give, devise, and bequeath all of the rest, residue, and remainder of my estate, of every kind and description, wherever situated, in equal shares as follows: fifty percent (50%) to my spouse, Jane Smith, and fifty percent (50%) to my daughter, Emma Smith. If my spouse, Jane Smith, does not survive me by thirty (30) days, her share shall pass to my secondary beneficiary, Emma Smith. If neither the primary nor secondary beneficiary survives me by thirty (30) days, then my estate shall pass to my heirs at law under Michigan intestate succession.

ARTICLE IV - CONTINGENT BENEFICIARIES

If Jane Smith does not survive me by thirty (30) days, I give my entire residuary estate to Emma Smith and Liam Smith in equal shares. If any contingent beneficiary shall predecease me, their share shall pass to the surviving contingent beneficiaries in equal shares.

ARTICLE V - APPOINTMENT OF EXECUTOR

I appoint my spouse, Jane Smith, as the Executor of this Will. If Jane Smith is unable or unwilling to serve, I appoint my son, Michael Smith, as Successor Executor. I direct that no bond shall be required of any Executor named herein.

ARTICLE VI - GUARDIAN APPOINTMENT

If my spouse does not survive me, I nominate Sarah Smith, my sister, as guardian of the person and estate of my minor children. If Sarah Smith is unable or unwilling to serve, I nominate Robert Smith as successor guardian. I request that no bond be required of any guardian named herein.

ARTICLE VII - NO-CONTEST CLAUSE

Any beneficiary who contests this Will shall forfeit their share, which shall be distributed among the remaining beneficiaries proportionally.

ARTICLE VIII - EXECUTOR POWERS

The Executor shall have full authority under the Michigan Estates and Protected Individuals Code (EPIC), MCL 700.3715, including but not limited to the power to sell, lease, mortgage, or otherwise deal with estate property, pay debts and expenses, distribute assets in kind or in cash, employ professionals, and compromise claims, all without court supervision where permitted by Michigan law.

ARTICLE IX - DIGITAL ASSETS

I authorize my Executor to access, manage, distribute, copy, delete, or terminate any digital asset, digital account, or electronically stored information owned by me, including but not limited to email accounts, social media accounts, financial accounts accessed online, cryptocurrency and digital currency, domain names, and any other digital property. This authority is granted pursuant to the Revised Uniform Fiduciary Access to Digital Assets Act as adopted in Michigan.

ARTICLE X - GOVERNING LAW

This Will shall be governed by and construed in accordance with the laws of the State of Michigan.

ARTICLE XI - SEVERABILITY

If any provision of this Will is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

ARTICLE XII - ATTESTATION

IN WITNESS WHEREOF, I have signed this Will on this 15th day of March, 2024, declaring it to be my Last Will and Testament in the presence of the witnesses below, who at my request and in my presence and in the presence of each other, have signed as witnesses.

Signed: John Smith
Date: March 15, 2024

WITNESS ATTESTATION

The foregoing instrument was signed, published, and declared by John Smith as their Last Will and Testament, in our presence, and we, at their request and in their presence and in the presence of each other, have signed our names as witnesses on this 15th day of March, 2024.

Witness Signature: Robert Johnson
Printed Name: Robert Johnson
Address: 412 Maple Avenue
City, State, ZIP: Detroit, MI 48201

Witness Signature: Patricia Williams
Printed Name: Patricia Williams
Address: 789 Oak Street
City, State, ZIP: Detroit, MI 48202

NOTARY ACKNOWLEDGMENT (SAMPLE - FILLED FOR DEMONSTRATION)
STATE OF MICHIGAN
COUNTY OF Wayne

On this 15th day of March, 2024, before me, the undersigned notary public, personally appeared John Smith, known to me to be the person whose name is subscribed to the within instrument, and acknowledged that they executed the same for the purposes therein contained.

WITNESS my hand and official seal.

Notary Public: Margaret Anderson, State of Michigan
My Commission Expires: January 1, 2028
Acting in the County of: Wayne

EXECUTION INSTRUCTIONS

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
Provide your Executor with a copy of this Will and confirm they are willing to serve in that role. Keep their contact information current.`;

async function main() {
  const pdfBuffer = await generatePDF(willText, "will", TESTATOR, "Sample Partner", undefined, "Detroit");
  const out = join(process.cwd(), "public", "sample-will.pdf");
  writeFileSync(out, pdfBuffer);
  console.log(`Saved: ${out} (${pdfBuffer.length} bytes)`);
  void SIGN_DATE;
}

main().catch((e) => { console.error(e); process.exit(1); });
