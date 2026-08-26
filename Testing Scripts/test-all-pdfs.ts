import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generateDoc, DOC_TYPES, OUTPUT_DIR } from "./_generate-doc";
import { sampleIntake } from "./_sample-intake";
import { generateFundingInstructionsPDF } from "../lib/documents/generate-funding-instructions";

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("🔨 Generating all estate planning documents...\n");

  for (const docType of DOC_TYPES) {
    await generateDoc(docType, sampleIntake);
  }

  console.log("Generating Trust Funding Instructions (no AI)...");
  const fundingPdf = await generateFundingInstructionsPDF(
    String(sampleIntake.firstName),
    String(sampleIntake.lastName),
    sampleIntake.assetTypes as string[]
  );
  const fundingPath = join(OUTPUT_DIR, "Trust Funding Instructions.pdf");
  writeFileSync(fundingPath, fundingPdf);
  console.log(`✅ PDF saved to: ${fundingPath}`);

  console.log(`\n🎉 All documents generated in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
