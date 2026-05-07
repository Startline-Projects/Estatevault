import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { willSystemPrompt, buildWillPrompt } from "../lib/documents/templates/michigan-will";
import { pourOverWillSystemPrompt, buildPourOverWillPrompt } from "../lib/documents/templates/michigan-pour-over-will";
import { generatePDF } from "../lib/documents/generate-pdf";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const dummyIntake = {
  firstName: "Jane",
  lastName: "Smith",
  dateOfBirth: "1975-04-15",
  city: "Detroit",
  executorName: "Robert Smith",
  executorRelationship: "Spouse",
  successorExecutorName: "Michael Smith",
  beneficiaries: [{ name: "Robert Smith", relationship: "Spouse", share: "" }],
  beneficiariesEqualShares: "",
  guardianName: "Sarah Johnson",
  guardianRelationship: "Sister",
  successorGuardianName: "David Johnson",
  hasSpecificGifts: "No",
  specificGiftsDescription: "",
  contingentBeneficiaries: [],
  contingentEqualShares: "Yes",
  trustName: "The Jane Smith Revocable Living Trust",
};

async function main() {
  const outDir = path.join(__dirname, "test-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ── WILL ──────────────────────────────────────────────────────────────────
  console.log("Generating Last Will and Testament...");
  const willResponse = await claude.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    system: willSystemPrompt,
    messages: [{ role: "user", content: buildWillPrompt(dummyIntake) }],
  });
  const willText = willResponse.content[0].type === "text" ? willResponse.content[0].text : "";

  const hasExecInstructions = willText.toUpperCase().includes("EXECUTION INSTRUCTIONS");
  console.log(hasExecInstructions ? "✓ EXECUTION INSTRUCTIONS found in will" : "✗ EXECUTION INSTRUCTIONS NOT found in will");

  const willPdf = await generatePDF(willText, "will", "Jane Smith");
  const willPath = path.join(outDir, "test-will.pdf");
  fs.writeFileSync(willPath, willPdf);
  console.log(`Will PDF saved → ${willPath}\n`);

  // ── POUR-OVER WILL ────────────────────────────────────────────────────────
  console.log("Generating Pour-Over Will...");
  const pourResponse = await claude.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system: pourOverWillSystemPrompt,
    messages: [{ role: "user", content: buildPourOverWillPrompt(dummyIntake) }],
  });
  const pourText = pourResponse.content[0].type === "text" ? pourResponse.content[0].text : "";

  const hasPourExec = pourText.toUpperCase().includes("EXECUTION INSTRUCTIONS");
  console.log(hasPourExec ? "✓ EXECUTION INSTRUCTIONS found in pour-over will" : "✗ EXECUTION INSTRUCTIONS NOT found in pour-over will");

  const pourPdf = await generatePDF(pourText, "pour_over_will", "Jane Smith");
  const pourPath = path.join(outDir, "test-pour-over-will.pdf");
  fs.writeFileSync(pourPath, pourPdf);
  console.log(`Pour-Over Will PDF saved → ${pourPath}`);
}

main().catch(console.error);
