/*
 * Prompt 1 verification for the v1.1.0 template pipeline (React-PDF).
 *
 * Renders each of the five documents through the real production path
 * (template → renderTemplate → parser → DocumentRenderer → PDF bytes) and
 * asserts the four formatting requirements against the produced bytes:
 *
 *   1. Document titles and section titles are centered.
 *   2. No "#" character appears anywhere in the rendered document.
 *   3. Notary and signature blocks never split across pages.
 *   4. "Operation of This Document" is a separate final page.
 */

import { mkdirSync, writeFileSync } from "fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { join } from "path";
import { readTemplateFile } from "../lib/documents/pdf/template-reader";
import { renderTemplate } from "../lib/documents/render-template";
import { renderReactPdf } from "../lib/documents/pdf/render";
import { parseRenderedText } from "../lib/documents/pdf/parser";
import { mapIntakeToTemplateData } from "../lib/documents/intake-adapter";
import { DOCUMENT_CONFIG, type DocumentType } from "../lib/documents/pdf/document-config";
import { extractDrawnText, toLines, type DrawnText } from "./_pdf-text";
import { sampleIntake } from "./_sample-intake";

const OUT = join(__dirname, "output", "v1.1.0");
const TYPES: DocumentType[] = ["will", "trust", "pour_over_will", "dpoa", "pad"];

/** TOKENS.letterSpacing.articleHeader — applied by ArticleHeader and DocumentHeader. */
const ARTICLE_LETTER_SPACING = 3;

let checks = 0;
let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  checks++;
  if (ok) console.log(`   ✓ ${label}`);
  else { failures++; console.log(`   ✗ ${label}${detail ? `\n       ${detail}` : ""}`); }
}

/** Text runs that make up the notary block, in draw order. */
const NOTARY_MARKERS = ["NOTARY ACKNOWLEDGMENT", "Notary Public, State of Michigan", "My commission expires"];

const LEFT_MARGIN = 72;

/** Compare label text ignoring whitespace, dashes and case. */
function normalize(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Real Times-Bold metrics, so centering is measured rather than estimated.
 * Headings carry letter spacing, which widens the line and has to be added back
 * in before the midpoint can be compared to the page midpoint.
 */
let boldFont: Awaited<ReturnType<PDFDocument["embedFont"]>>;
async function initMetrics() {
  const doc = await PDFDocument.create();
  boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
}

function lineWidth(d: DrawnText, letterSpacing: number): number {
  return boldFont.widthOfTextAtSize(d.text, d.size) + Math.max(0, d.text.length - 1) * letterSpacing;
}

/**
 * A centered line starts right of the left margin and is symmetric about the
 * page midpoint. Left-aligned body text always starts at exactly the margin.
 */
function isCentered(d: DrawnText, letterSpacing: number): boolean {
  if (d.x <= LEFT_MARGIN + 4) return false;
  const mid = d.x + lineWidth(d, letterSpacing) / 2;
  return Math.abs(mid - d.pageWidth / 2) <= 8;
}

async function run() {
  await initMetrics();
  mkdirSync(OUT, { recursive: true });
  const adapted = mapIntakeToTemplateData({
    ...(sampleIntake as Record<string, unknown>),
    lifeSustainingTreatment: "withhold_if_terminal_or_pvs",
    artificialNutrition: "withhold_if_terminal_or_pvs",
  });
  if (adapted.error) throw new Error(`adapter: ${adapted.error}`);
  const data = adapted.data!;

  console.log("═".repeat(72));
  console.log(" Prompt 1 on the v1.1.0 template pipeline");
  console.log("═".repeat(72));

  for (const t of TYPES) {
    console.log(`\n▸ ${DOCUMENT_CONFIG[t].title}`);
    const text = renderTemplate(await readTemplateFile(t), data);
    const blocks = parseRenderedText(text);

    const { pdfBuffer } = await renderReactPdf(
      text, t,
      { isWhiteLabel: false, productName: "EstateVault" },
      "Ahmed R. Hassan",
    );
    const path = join(OUT, `${DOCUMENT_CONFIG[t].filenameLabel}.pdf`);
    writeFileSync(path, pdfBuffer);

    const drawn = toLines(await extractDrawnText(pdfBuffer));
    const pages = Math.max(...drawn.map((d) => d.page));
    console.log(`   ${blocks.length} blocks → ${pages} pages, ${drawn.length} text runs`);
    console.log(`   ${path}`);

    // ── 2. no hashtags ──
    const hashRuns = drawn.filter((d) => d.text.includes("#"));
    check(hashRuns.length === 0, "no '#' character in the rendered PDF",
      hashRuns.slice(0, 3).map((h) => `p${h.page}: ${h.text}`).join("\n       "));

    // ── 1. centering ──
    const headerTexts = new Set<string>();
    for (const b of blocks) {
      if (b.type === "article_header") { headerTexts.add(`ARTICLE ${b.number}`); if (b.title) headerTexts.add(b.title); }
      if (b.type === "document_header") headerTexts.add(b.text.toUpperCase());
      if (b.type === "section_header") headerTexts.add(`Section ${b.number}.${b.title ? `  ${b.title}` : ""}`);
    }
    const headerRuns = drawn.filter((d) => headerTexts.has(d.text.trim()));
    // Article and document headers carry letter spacing; section headers do not.
    const spacedHeaders = new Set<string>();
    for (const b of blocks) {
      if (b.type === "article_header") { spacedHeaders.add(`ARTICLE ${b.number}`); if (b.title) spacedHeaders.add(b.title); }
      if (b.type === "document_header") spacedHeaders.add(b.text.toUpperCase());
    }
    const offCenter = headerRuns.filter((d) => !isCentered(d, spacedHeaders.has(d.text.trim()) ? ARTICLE_LETTER_SPACING : 0));
    check(headerRuns.length > 0, `document/section titles located in the PDF (${headerRuns.length})`);
    check(offCenter.length === 0, "all located titles are centered",
      offCenter.slice(0, 4).map((o) => `p${o.page} x=${o.x.toFixed(0)} "${o.text}"`).join("\n       "));

    // ── 3a. notary block unsplit ──
    const notaryPages = new Set(
      drawn.filter((d) => NOTARY_MARKERS.some((m) => d.text.includes(m))).map((d) => d.page),
    );
    if (notaryPages.size === 0) {
      console.log("   – no notary block in this document (skipped)");
    } else {
      check(notaryPages.size === 1, "notary block sits entirely on one page",
        `pages ${Array.from(notaryPages).join(", ")}`);
    }

    // ── 3b. signature runs unsplit ──
    // Labels repeat across the document (an attestation block and a
    // self-proving affidavit both sign "Testator"), so runs are matched
    // sequentially against the drawn lines rather than by first occurrence.
    const runs: string[][] = [];
    let cur: string[] = [];
    for (const b of blocks) {
      if (b.type === "signature") cur.push((b as { label: string }).label);
      else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    const sigCount = runs.reduce((n, r) => n + r.length, 0);

    let cursor = 0;
    const splitRuns: string[] = [];
    const unmatched: string[] = [];
    for (const runLabels of runs) {
      const pagesSeen: number[] = [];
      for (const label of runLabels) {
        const want = normalize(label);
        let found = -1;
        for (let k = cursor; k < drawn.length; k++) {
          if (normalize(drawn[k].text) === want) { found = k; break; }
        }
        if (found === -1) { unmatched.push(label); continue; }
        pagesSeen.push(drawn[found].page);
        cursor = found + 1;
      }
      if (new Set(pagesSeen).size > 1) {
        splitRuns.push(`${runLabels.join(" / ")} → pages ${Array.from(new Set(pagesSeen)).join(", ")}`);
      }
    }

    check(sigCount > 0, `signature lines rendered (${sigCount} in ${runs.length} runs)`);
    check(unmatched.length === 0, "every signature label located in the PDF", unmatched.join(", "));
    check(splitRuns.length === 0, "no signature run splits across pages", splitRuns.join("\n       "));
    const sigLabels = runs.flat();

    // ── 4. instruction sheet is the final page ──
    const sheetRun = drawn.find((d) => d.text.trim() === "OPERATION OF THIS DOCUMENT");
    check(Boolean(sheetRun), '"OPERATION OF THIS DOCUMENT" present');
    if (sheetRun) {
      const lastSig = Math.max(0, ...drawn.filter((d) => sigLabels.some((l) => d.text.trim() === l.trim())).map((d) => d.page));
      const lastNotary = notaryPages.size ? Math.max(...Array.from(notaryPages)) : 0;
      check(sheetRun.page > lastSig && sheetRun.page > lastNotary,
        "instruction sheet starts after all signature and notary pages",
        `sheet p${sheetRun.page}; last signature p${lastSig}; last notary p${lastNotary}`);
      check(sheetRun.page === pages || sheetRun.page === pages - 1,
        "instruction sheet is the final page (or pages)",
        `sheet p${sheetRun.page} of ${pages}`);
    }
  }

  console.log("\n" + "═".repeat(72));
  console.log(` ${checks - failures}/${checks} checks passed`);
  console.log("═".repeat(72));
  if (failures) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
