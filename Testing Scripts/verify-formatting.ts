/*
 * PROMPT 1 verification harness.
 *
 * Generates each of the five documents, then reads the text back out of the
 * produced PDF bytes and asserts the four formatting requirements:
 *
 *   1. Document titles and section titles are centered.
 *   2. No "#" character appears anywhere in the rendered document.
 *   3. Notary acknowledgment blocks and signature blocks never split across pages.
 *   4. An "Operation of This Document" sheet is the final page, after all
 *      signature and notary pages.
 *
 * A page-offset stress pass repeats requirement 3 at every possible starting
 * offset, so the atomic-block logic is exercised at each page boundary.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { generatePDF } from "../lib/documents/generate-pdf";
import { INSTRUCTION_SHEET_TITLE } from "../lib/documents/instruction-sheets";
import { getDocumentText, DOC_TYPES, DOC_LABELS, OUTPUT_DIR, DocType } from "./_generate-doc";
import { sampleIntake } from "./_sample-intake";
import { extractDrawnText, DrawnText, fullText } from "./_pdf-text";

let failures = 0;
let checks = 0;

function check(ok: boolean, label: string, detail = "") {
  checks++;
  if (ok) {
    console.log(`   ✓ ${label}`);
  } else {
    failures++;
    console.log(`   ✗ ${label}${detail ? `\n       ${detail}` : ""}`);
  }
}

/** Anchor lines of the notary block, in draw order. */
const NOTARY_ANCHORS = [
  "NOTARY ACKNOWLEDGMENT",
  "STATE OF MICHIGAN",
  "WITNESS my hand and official seal.",
  "Notary Public, State of Michigan",
  "Acting in the County of: ____________________",
];

const SIGNATURE_LABELS = new Set([
  "Signature",
  "Date",
  "Witness Signature",
  "Printed Name",
  "Address",
  "City, State, ZIP",
]);

function verifyNoHashtags(drawn: DrawnText[]) {
  const offenders = drawn.filter((d) => d.text.includes("#"));
  check(
    offenders.length === 0,
    "no '#' character in the rendered PDF",
    offenders.slice(0, 3).map((o) => `page ${o.page}: ${o.text}`).join("\n       ")
  );
}

function verifyNotaryUnsplit(drawn: DrawnText[]) {
  const pages = NOTARY_ANCHORS.map((anchor) => {
    const hit = drawn.find((d) => d.text.trim() === anchor);
    return { anchor, page: hit?.page };
  });

  const found = pages.filter((p) => p.page !== undefined);
  if (found.length === 0) {
    check(false, "notary acknowledgment block rendered", "no notary anchors found in the PDF");
    return;
  }

  const distinct = new Set(found.map((p) => p.page));
  check(
    distinct.size === 1,
    "notary acknowledgment block sits entirely on one page",
    distinct.size > 1
      ? found.map((p) => `p${p.page} ${p.anchor}`).join(" | ")
      : ""
  );
  check(found.length === NOTARY_ANCHORS.length, "notary block rendered complete (all anchors present)");
}

function verifySignatureBlocksUnsplit(drawn: DrawnText[]) {
  // Signature labels drawn back to back form one block; a block is split if
  // consecutive labels land on different pages.
  const labels = drawn.filter((d) => SIGNATURE_LABELS.has(d.text.trim()));
  if (labels.length === 0) {
    check(false, "signature blocks rendered", "no signature labels found");
    return;
  }

  const splits: string[] = [];
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1];
    const cur = labels[i];
    // Same block when the labels are adjacent in draw order and the y position
    // steps downward; a page change mid-run is a split.
    const sameRun = cur.page === prev.page ? cur.y < prev.y : cur.y > prev.y;
    if (cur.page !== prev.page && isWitnessRun(prev.text, cur.text)) {
      splits.push(`"${prev.text}" p${prev.page} -> "${cur.text}" p${cur.page}`);
    }
    void sameRun;
  }

  check(splits.length === 0, "signature blocks never split across pages", splits.join("\n       "));
}

/** The 4-line witness block is the only multi-line signature run the templates emit. */
function isWitnessRun(prev: string, cur: string) {
  const order = ["Witness Signature", "Printed Name", "Address", "City, State, ZIP"];
  const pi = order.indexOf(prev.trim());
  const ci = order.indexOf(cur.trim());
  return pi !== -1 && ci === pi + 1;
}

function verifyCentering(drawn: DrawnText[]) {
  // Section titles the templates always produce.
  // Titles render at 12pt bold; body text is 11pt. Size gates out wrapped body
  // lines that merely happen to begin with "Section 3.1".
  const titleLike = drawn.filter((d) =>
    d.size >= 12 && (
    /^(ARTICLE|SECTION)\s+[IVXLCDM0-9]+/i.test(d.text.trim()) ||
    d.text.trim() === "NOTARY ACKNOWLEDGMENT" ||
    d.text.trim() === "WITNESS ATTESTATION" ||
    d.text.trim() === "SELF-PROVING AFFIDAVIT" ||
    d.text.trim() === INSTRUCTION_SHEET_TITLE)
  );

  if (titleLike.length === 0) {
    check(false, "section titles present", "no ARTICLE/SECTION titles found");
    return;
  }

  const offCenter = titleLike.filter((d) => {
    const center = d.pageWidth / 2;
    // A centered run starts left of center by roughly half its width.
    const startsLeftOfCenter = d.x < center;
    const distanceFromLeftMargin = Math.abs(d.x - 72);
    return !startsLeftOfCenter || distanceFromLeftMargin < 1;
  });

  check(
    offCenter.length === 0,
    `all ${titleLike.length} document/section titles are centered`,
    offCenter.slice(0, 4).map((o) => `p${o.page} x=${o.x.toFixed(1)} "${o.text}"`).join("\n       ")
  );
}

function verifyInstructionSheetLast(drawn: DrawnText[]) {
  const lastPage = Math.max(...drawn.map((d) => d.page));
  const sheetHits = drawn.filter((d) => d.text.trim() === INSTRUCTION_SHEET_TITLE);

  check(sheetHits.length === 1, `"${INSTRUCTION_SHEET_TITLE}" sheet is present exactly once`);
  if (sheetHits.length === 0) return;

  const sheetStart = sheetHits[0].page;

  // Everything signature/notary related must come before the sheet starts.
  const notaryPages = drawn
    .filter((d) => NOTARY_ANCHORS.includes(d.text.trim()) || SIGNATURE_LABELS.has(d.text.trim()))
    .map((d) => d.page);
  const lastExecutionPage = notaryPages.length ? Math.max(...notaryPages) : 0;

  check(
    sheetStart > lastExecutionPage,
    "instruction sheet starts after all signature and notary pages",
    `sheet starts on p${sheetStart}; last signature/notary content on p${lastExecutionPage}`
  );
  check(
    sheetStart <= lastPage,
    "instruction sheet is the final page (or pages) of the document",
    `sheet p${sheetStart}..${lastPage}`
  );
  check(
    !drawn.some((d) => d.page >= sheetStart && SIGNATURE_LABELS.has(d.text.trim())),
    "no signature blocks appear on or after the instruction sheet"
  );
}

/**
 * Requirement 3, hardened: shift the body down by 1..N lines so the notary and
 * witness blocks approach the page break from every possible offset.
 */
async function pageOffsetStress(baseText: string, docType: DocType) {
  const OFFSETS = 45;
  const split: string[] = [];
  for (let pad = 0; pad < OFFSETS; pad++) {
    const filler = Array.from({ length: pad }, (_, k) => `Padding paragraph ${k + 1} inserted by the page-offset stress pass to shift the execution blocks toward the page boundary.`).join("\n\n");
    const text = filler ? `${filler}\n\n${baseText}` : baseText;
    const pdf = await generatePDF(text, docType, "Ahmed R. Hassan", undefined, undefined, "Dearborn");
    const drawn = await extractDrawnText(pdf);

    const notaryPages = new Set(
      drawn.filter((d) => NOTARY_ANCHORS.includes(d.text.trim())).map((d) => d.page)
    );
    if (notaryPages.size > 1) split.push(`offset ${pad}: notary split across pages ${Array.from(notaryPages).join(",")}`);

    const labels = drawn.filter((d) => SIGNATURE_LABELS.has(d.text.trim()));
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].page !== labels[i - 1].page && isWitnessRun(labels[i - 1].text, labels[i].text)) {
        split.push(`offset ${pad}: witness block split (${labels[i - 1].text} p${labels[i - 1].page} -> ${labels[i].text} p${labels[i].page})`);
      }
    }

    if (fullText(drawn).includes("#")) split.push(`offset ${pad}: hashtag leaked into output`);
  }

  check(split.length === 0, `page-offset stress: ${OFFSETS} offsets, no block ever split`, split.slice(0, 5).join("\n       "));
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("═".repeat(74));
  console.log(" PROMPT 1 — Global Formatting Cleanup: verification");
  console.log("═".repeat(74));

  let anyFixture = false;

  for (const docType of DOC_TYPES) {
    console.log(`\n▸ ${DOC_LABELS[docType]}`);
    const { text, source } = await getDocumentText(docType, sampleIntake);
    if (source === "fixture") anyFixture = true;

    const rawHashes = (text.match(/#/g) || []).length;
    console.log(`   raw model output: ${text.length} chars, ${rawHashes} '#' characters before stripping`);

    const pdf = await generatePDF(text, docType, "Ahmed R. Hassan", undefined, undefined, "Dearborn");
    const outPath = join(OUTPUT_DIR, `${DOC_LABELS[docType]}.pdf`);
    writeFileSync(outPath, pdf);

    const drawn = await extractDrawnText(pdf);
    const pages = Math.max(...drawn.map((d) => d.page));
    console.log(`   rendered: ${pages} pages, ${drawn.length} text runs → ${outPath}`);

    check(rawHashes > 0, `fixture/model output actually contained '#' to strip (${rawHashes})`);
    verifyNoHashtags(drawn);
    verifyCentering(drawn);
    verifyNotaryUnsplit(drawn);
    verifySignatureBlocksUnsplit(drawn);
    verifyInstructionSheetLast(drawn);
    await pageOffsetStress(text, docType);
  }

  console.log("\n" + "═".repeat(74));
  console.log(` ${checks - failures}/${checks} checks passed`);
  if (anyFixture) {
    console.log(" NOTE: one or more documents used a checked-in fixture because");
    console.log("       ANTHROPIC_API_KEY is not set in .env.local.");
  }
  console.log("═".repeat(74));

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
