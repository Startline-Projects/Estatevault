import Anthropic from "@anthropic-ai/sdk";
import { trustSystemPrompt, buildTrustPrompt } from "../lib/documents/templates/michigan-revocable-trust";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const dummyIntake = {
  firstName: "Jane",
  lastName: "Smith",
  dateOfBirth: "1975-04-15",
  city: "Grand Rapids",
  trustName: "The Jane Smith Revocable Living Trust",
  primaryTrustee: "Myself",
  trusteeName: "Jane Smith",
  successorTrusteeName: "Robert Smith",
  successorTrusteeRelationship: "Spouse/Partner",
  secondSuccessorTrusteeName: "Michael Smith",
  primaryBeneficiaryName: "Robert Smith",
  primaryBeneficiaryRelationship: "Spouse/Partner",
  hasSecondBeneficiary: "No",
  estateSplit: "",
  customSplit: "",
  distributionAge: "25",
  hasMinorChildren: "No",
  hasContingentBeneficiary: "No",
  contingentBeneficiaries: [],
  contingentEqualShares: "Yes",
  guardianName: "",
  guardianRelationship: "",
  successorGuardianName: "",
  assetTypes: ["Primary home / real estate in Michigan", "Bank and investment accounts"],
  hasSpecificGifts: "No",
  specificGiftsDescription: "",
};

async function main() {
  console.log("Generating trust document...\n");

  const userPrompt = buildTrustPrompt(dummyIntake);

  const response = await claude.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    system: trustSystemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  console.log("=== FULL DOCUMENT ===\n");
  console.log(text);

  console.log("\n=== BANKING POWERS CHECK ===");
  const hasBanking = text.toUpperCase().includes("BANKING POWERS");
  console.log(hasBanking ? "✓ BANKING POWERS article FOUND" : "✗ BANKING POWERS article NOT FOUND");

  if (hasBanking) {
    const idx = text.toUpperCase().indexOf("BANKING POWERS");
    const snippet = text.slice(Math.max(0, idx - 50), idx + 500);
    console.log("\n--- Excerpt ---\n" + snippet);
  }
}

main().catch(console.error);
