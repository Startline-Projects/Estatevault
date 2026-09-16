// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { generatePDF } from "../lib/documents/generate-pdf";

export type DocType = "will" | "trust" | "pour_over_will" | "poa" | "healthcare_directive";

export const DOC_LABELS: Record<DocType, string> = {
  will: "Last Will and Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

export const DOC_TYPES: DocType[] = ["will", "trust", "pour_over_will", "poa", "healthcare_directive"];

export const OUTPUT_DIR = join(__dirname, "output");

function hasApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key !== "placeholder");
}

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

/**
 * Returns the raw model output for a document.
 *
 * With ANTHROPIC_API_KEY set, this calls Claude, exactly as production does.
 * Without a key it falls back to a checked-in fixture that carries the same
 * markdown contamination real output exhibits, so formatting can still be
 * verified end to end. The fallback is announced loudly, never silently.
 */
export async function getDocumentText(
  docType: DocType,
  intake: Record<string, unknown>
): Promise<{ text: string; source: "claude" | "fixture" }> {
  const forceFixture = process.env.USE_FIXTURES === "1";

  if (!forceFixture && hasApiKey()) {
    const { claude, CLAUDE_MODEL } = await import("../lib/claude");
    const template = await getTemplate(docType);
    const maxTokens = docType === "trust" ? 16000 : 8000;

    console.log(`  → calling Claude (${CLAUDE_MODEL})...`);
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: template.systemPrompt,
      messages: [{ role: "user", content: template.buildPrompt(intake) }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    console.log(`  → Claude returned ${text.length} chars (stop_reason: ${response.stop_reason})`);
    return { text, source: "claude" };
  }

  const fixturePath = join(__dirname, "_fixtures", `${docType}.txt`);
  if (!existsSync(fixturePath)) {
    throw new Error(`No ANTHROPIC_API_KEY and no fixture at ${fixturePath}`);
  }

  console.log(
    forceFixture
      ? "  ⚠ USE_FIXTURES=1 — using checked-in fixture instead of the Claude API."
      : "  ⚠ ANTHROPIC_API_KEY not set in .env.local — using checked-in fixture instead of the Claude API."
  );
  return { text: readFileSync(fixturePath, "utf8"), source: "fixture" };
}

export async function generateDoc(docType: DocType, intake: Record<string, unknown>) {
  const label = DOC_LABELS[docType];
  console.log(`Generating ${label}...`);

  const { text: documentText, source } = await getDocumentText(docType, intake);

  const clientName = `${intake.firstName || ""} ${intake.lastName || ""}`.trim();
  const pdfBuffer = await generatePDF(
    documentText,
    docType,
    clientName,
    undefined,
    undefined,
    String(intake.city || "")
  );

  const outputPath = join(OUTPUT_DIR, `${label}.pdf`);
  writeFileSync(outputPath, pdfBuffer);

  console.log(`✅ PDF saved to: ${outputPath}  (source: ${source})\n`);
  return outputPath;
}
