import { writeFileSync } from "fs";
import { join } from "path";
import { generatePDF } from "../lib/documents/generate-pdf";

const sampleText = `LAST WILL AND TESTAMENT OF JANE Q. SAMPLE

ARTICLE I — DECLARATION

I, Jane Q. Sample, a resident of Wayne County, Michigan, being of sound mind and memory, do hereby make, publish, and declare this to be my Last Will and Testament, hereby revoking all wills and codicils previously made by me.

ARTICLE II — FAMILY

I am married to John A. Sample. We have two children: Alex Sample and Riley Sample. All references to "my children" in this Will refer to the foregoing children.

ARTICLE III — APPOINTMENT OF PERSONAL REPRESENTATIVE

I nominate my spouse, John A. Sample, to serve as Personal Representative of my estate. If unable or unwilling to serve, I nominate my sister, Mary Example, as successor Personal Representative.

ARTICLE IV — DISPOSITION OF PROPERTY

I give, devise, and bequeath all of my property, of every kind and nature, to my spouse if surviving me. If my spouse does not survive me, I give my entire estate equally to my then-living children.

ARTICLE V — EXECUTION

IN WITNESS WHEREOF, I have hereunto set my hand this [DATE LINE] at Detroit, Michigan.

[SIGNATURE LINE]

WITNESS ATTESTATION

The foregoing instrument was signed by the Testator in our presence and at the Testator's request, and we, in the Testator's presence and in the presence of each other, have hereunto subscribed our names as witnesses.

[WITNESS SIGNATURE]

[WITNESS SIGNATURE]

[NOTARY BLOCK]
`;

async function main() {
  const pdf = await generatePDF(sampleText, "will", "Jane Q. Sample", "EstateVault Demo Partner");
  const out = join(__dirname, "sample-with-logo.pdf");
  writeFileSync(out, pdf);
  console.log("Saved:", out);
}

main().catch((e) => { console.error(e); process.exit(1); });
