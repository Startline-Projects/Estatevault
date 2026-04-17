// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

import { writeFileSync } from "fs";
import { join } from "path";
import { claude, CLAUDE_MODEL } from "../lib/claude";
import { generatePDF } from "../lib/documents/generate-pdf";

type DocType = "will" | "trust" | "pour_over_will" | "poa" | "healthcare_directive";

const DOC_LABELS: Record<DocType, string> = {
  will: "Last Will and Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

async function getTemplate(docType: DocType) {
  switch (docType) {
    case "will": {
      const { willSystemPrompt, buildWillPrompt } = await import("../lib/documents/templates/michigan-will");
      return { systemPrompt: willSystemPrompt, buildPrompt: buildWillPrompt };
    }
    case "trust": {
      const { trustSystemPrompt, buildTrustPrompt } = await import("../lib/documents/templates/michigan-revocable-trust");
      return { systemPrompt: trustSystemPrompt, buildPrompt: buildTrustPrompt };
    }
    case "pour_over_will": {
      const { pourOverWillSystemPrompt, buildPourOverWillPrompt } = await import("../lib/documents/templates/michigan-pour-over-will");
      return { systemPrompt: pourOverWillSystemPrompt, buildPrompt: buildPourOverWillPrompt };
    }
    case "poa": {
      const { poaSystemPrompt, buildPOAPrompt } = await import("../lib/documents/templates/michigan-poa");
      return { systemPrompt: poaSystemPrompt, buildPrompt: buildPOAPrompt };
    }
    case "healthcare_directive": {
      const { hcdSystemPrompt, buildHCDPrompt } = await import("../lib/documents/templates/michigan-healthcare-directive");
      return { systemPrompt: hcdSystemPrompt, buildPrompt: buildHCDPrompt };
    }
  }
}

export async function generateDoc(docType: DocType, intake: Record<string, unknown>) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
    throw new Error("ANTHROPIC_API_KEY is not set in .env.local");
  }

  const label = DOC_LABELS[docType];
  console.log(`Generating ${label} via Claude (${CLAUDE_MODEL})...`);

  const template = await getTemplate(docType);
  const userPrompt = template.buildPrompt(intake);
  const maxTokens = docType === "trust" ? 16000 : 8000;

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: template.systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const documentText = response.content[0].type === "text" ? response.content[0].text : "";
  console.log(`  → Claude returned ${documentText.length} chars (stop_reason: ${response.stop_reason})`);

  const clientName = `${intake.firstName || ""} ${intake.lastName || ""}`.trim();
  const pdfBuffer = await generatePDF(
    documentText,
    docType,
    clientName,
    undefined,
    undefined,
    String(intake.city || "")
  );

  const outputPath = join(__dirname, `${label}.pdf`);
  writeFileSync(outputPath, pdfBuffer);

  console.log(`\n✅ PDF saved to: ${outputPath}`);
  return outputPath;
}
