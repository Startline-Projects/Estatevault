import { writeFileSync } from "fs";
import { join } from "path";
import { generateDoc } from "./_generate-doc";
import { sampleIntake } from "./_sample-intake";
import { generateFundingInstructionsPDF } from "../lib/documents/generate-funding-instructions";

async function main() {
  console.log("🔨 Generating all 6 estate planning documents...\n");

  await generateDoc("will", sampleIntake);
  await generateDoc("trust", sampleIntake);
  await generateDoc("pour_over_will", sampleIntake);
  await generateDoc("poa", sampleIntake);
  await generateDoc("healthcare_directive", sampleIntake);

  console.log("\nGenerating Trust Funding Instructions (no AI)...");
  const fundingPdf = await generateFundingInstructionsPDF(
    String(sampleIntake.firstName),
    String(sampleIntake.lastName),
    sampleIntake.assetTypes as string[]
  );
  const fundingPath = join(__dirname, "Trust Funding Instructions.pdf");
  writeFileSync(fundingPath, fundingPdf);
  console.log(`✅ PDF saved to: ${fundingPath}`);

  console.log("\n🎉 All documents generated in Testing Scripts/");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
