import { writeFileSync } from "fs";
import { join } from "path";
import { generateFundingInstructionsPDF } from "../lib/documents/generate-funding-instructions";

async function main() {
  const firstName = process.argv[2] || "John";
  const lastName = process.argv[3] || "Smith";

  const assetTypes = [
    "Primary home / real estate in Michigan",
    "Real estate in another state",
    "Bank and investment accounts",
    "Business interests",
    "Vehicles",
    "Personal property and valuables",
    "Digital assets and cryptocurrency",
  ];

  console.log(`Generating Trust Funding Instructions PDF for ${firstName} ${lastName}...`);

  const pdfBytes = await generateFundingInstructionsPDF(firstName, lastName, assetTypes);

  const outputPath = join(__dirname, "Trust Funding Instructions.pdf");
  writeFileSync(outputPath, pdfBytes);

  console.log(`\n✅ PDF saved to: ${outputPath}`);
  console.log(`\nOpen it and check these sections for the [Your Name] bug:`);
  console.log(`  - Real Estate in Michigan (step 2)`);
  console.log(`  - Bank and Investment Accounts (step 3)`);
  console.log(`  - Vehicles (step 3)`);
}

main().catch((err) => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});
