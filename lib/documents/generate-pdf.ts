/*
 * DOCUMENT GENERATION, ATTORNEY SUPERVISED
 * Template Version: 1.0.0-michigan
 * Attorney Approval Date: [TO BE FILLED]
 * Approved By: [TO BE FILLED]
 */

import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFImage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { getInstructionSheet } from "./instruction-sheets";

let cachedLogoBytes: Buffer | null = null;
function loadLogoBytes(): Buffer | null {
  if (cachedLogoBytes) return cachedLogoBytes;
  try {
    const p = path.join(process.cwd(), "public", "logo.png");
    cachedLogoBytes = fs.readFileSync(p);
    return cachedLogoBytes;
  } catch {
    return null;
  }
}

async function fetchRemoteLogo(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export const TYPE_NAMES: Record<string, string> = {
  will: "Last Will and Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Patient Advocate Designation",
};

export interface ParsedLine {
  type: "text" | "blank" | "signature_line" | "notary_block";
  text?: string;
  label?: string;
  bold?: boolean;
  centered?: boolean;
}

/** One ruled line inside a signature block. */
interface SignatureItem {
  label: string;
  /** True when a blank line separated this item from the previous one. */
  gapBefore: boolean;
}

/**
 * A run of consecutive signature lines is treated as ONE atomic block so it can
 * never be split across a page boundary.
 */
type Block =
  | { kind: "text"; text: string; bold: boolean; centered: boolean }
  | { kind: "blank" }
  | { kind: "signature_block"; items: SignatureItem[] }
  | { kind: "notary_block" };

// ── MARKDOWN STRIPPING ────────────────────────────────────────────────────────
// Claude is instructed to return plain text, but it intermittently emits markdown
// anyway. Nothing below this point may leak a "#" into a rendered document.

/** ATX heading: up to 3 leading spaces, 1-6 hashes, optional closing hashes. */
const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]*(.*?)[ \t]*#*$/;
/** Setext-style / horizontal rules that carry no content. */
const RULE_LINE = /^ {0,3}([-=_*])(?:[ \t]*\1){2,}[ \t]*$/;

/** Removes inline markdown from a single line and guarantees no "#" survives. */
function stripInlineMarkdown(line: string): string {
  return (
    line
      // emphasis, longest delimiter first
      .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
      .replace(/___(.*?)___/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      // links: [text](url) -> text
      .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1")
      // blockquote / list markers
      .replace(/^[ \t]*>[ \t]?/, "")
      // any unmatched emphasis characters left over
      .replace(/\*+/g, "")
      // FINAL SWEEP: no hashtag character may reach the PDF, in any position.
      .replace(/#/g, "")
      // tidy the whitespace the removals leave behind
      .replace(/[ \t]{2,}/g, " ")
      .trimEnd()
  );
}

/**
 * Strips markdown from a full document.
 * Guarantee: the returned string contains no "#" character.
 * Exported for testing.
 */
export function stripMarkdown(text: string): string {
  const out = text
    .split("\n")
    .map((raw) => {
      if (RULE_LINE.test(raw)) return "";
      const heading = raw.match(ATX_HEADING);
      const body = heading ? heading[2] : raw;
      return stripInlineMarkdown(body);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

/** True when the text still contains a hashtag. Used by the verification harness. */
export function containsHashtag(text: string): boolean {
  return text.includes("#");
}

// ── HEADING DETECTION ─────────────────────────────────────────────────────────

const ARTICLE_RE = /^ARTICLE\s+[IVXLCDM0-9]+\b/i;
const SECTION_RE = /^SECTION\s+[0-9IVXLCDM]+[.:)]?/i;
const NUMBERED_TITLE_RE = /^\d+(\.\d+)*[.):]?\s+\S/;

/** Known block titles that must always be centered even if they fail the generic tests. */
const KNOWN_HEADINGS = [
  "NOTARY ACKNOWLEDGMENT",
  "SELF-PROVING AFFIDAVIT",
  "WITNESS ATTESTATION",
  "ATTESTATION CLAUSE",
  "AGENT'S ACKNOWLEDGMENT OF DUTIES",
  "ACCEPTANCE BY PATIENT ADVOCATE",
  "ACCEPTANCE OF TRUSTEE",
  "EXECUTION INSTRUCTIONS",
];

/**
 * Decides whether a line is a document title or section title.
 * Titles are centered and bold; everything else is left-aligned body text.
 */
function isHeadingLine(text: string, wasMarkdownHeading: boolean): boolean {
  if (wasMarkdownHeading) return true;

  const t = text.trim();
  if (!t || t.length > 90) return false;
  if (/^[_\s]+$/.test(t)) return false;
  if (!/[A-Za-z]/.test(t)) return false;

  const upper = t.toUpperCase();
  if (KNOWN_HEADINGS.some((h) => upper === h || upper.startsWith(`${h}:`) || upper.startsWith(`${h} `))) {
    // "EXECUTION INSTRUCTIONS: To make this Will valid..." is a paragraph, not a title.
    return t.length <= 60;
  }

  if (ARTICLE_RE.test(t) || SECTION_RE.test(t)) return t.length <= 90;

  const isAllCaps = t === upper && t.length > 3;
  if (isAllCaps) {
    // Sentences set in caps ("IN WITNESS WHEREOF, I have...") are body text.
    if (t.includes(",")) return false;
    if (/[.,;:]$/.test(t) && !/^\w+\s+[IVXLCDM0-9]+\.$/.test(t)) return false;
    return t.length <= 80;
  }

  // "3.3 Backup Distribution" style numbered titles: short, no terminal period.
  if (NUMBERED_TITLE_RE.test(t) && t.length <= 70 && !/[.;:]$/.test(t)) {
    const words = t.split(/\s+/);
    if (words.length <= 9) return true;
  }

  return false;
}

// ── PARSING ───────────────────────────────────────────────────────────────────

export function parseDocumentText(rawText: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const rawLines = rawText.replace(/\r\n/g, "\n").split("\n");
  let notaryRendered = false;
  let blankRun = 0;

  for (const raw of rawLines) {
    if (RULE_LINE.test(raw)) continue;

    const headingMatch = raw.match(ATX_HEADING);
    const wasMarkdownHeading = Boolean(headingMatch);
    const trimmed = stripInlineMarkdown(headingMatch ? headingMatch[2] : raw).trim();

    if (!trimmed) {
      blankRun++;
      if (blankRun <= 1) lines.push({ type: "blank" });
      continue;
    }
    blankRun = 0;

    // Skip raw HTML tags
    if (trimmed.startsWith("<") && trimmed.includes(">")) continue;

    // Exact placeholder matches
    if (trimmed === "[SIGNATURE LINE]") { lines.push({ type: "signature_line", label: "Signature" }); continue; }
    if (trimmed === "[DATE LINE]") { lines.push({ type: "signature_line", label: "Date" }); continue; }
    if (trimmed === "[WITNESS SIGNATURE]") {
      lines.push({ type: "signature_line", label: "Witness Signature" });
      lines.push({ type: "signature_line", label: "Printed Name" });
      lines.push({ type: "signature_line", label: "Address" });
      lines.push({ type: "signature_line", label: "City, State, ZIP" });
      continue;
    }
    if (trimmed === "[NOTARY BLOCK]") {
      if (!notaryRendered) { lines.push({ type: "notary_block" }); notaryRendered = true; }
      continue;
    }

    // Catch any remaining bracket placeholders
    if (/^\[.+\]$/.test(trimmed)) {
      if (trimmed.includes("DATE")) {
        lines.push({ type: "signature_line", label: "Date" });
      } else if (trimmed.includes("SIGNATURE") || trimmed.includes("SIGN")) {
        lines.push({ type: "signature_line", label: "Signature" });
      } else if (trimmed.includes("NOTARY")) {
        if (!notaryRendered) { lines.push({ type: "notary_block" }); notaryRendered = true; }
      } else if (trimmed.includes("WITNESS")) {
        lines.push({ type: "signature_line", label: "Witness Signature" });
        lines.push({ type: "signature_line", label: "Printed Name" });
        lines.push({ type: "signature_line", label: "Address" });
        lines.push({ type: "signature_line", label: "City, State, ZIP" });
      } else {
        lines.push({ type: "signature_line", label: trimmed.replace(/[\[\]]/g, "") });
      }
      continue;
    }

    // Inline placeholders within text (e.g. "I set my hand this [DATE LINE] at...")
    if (trimmed.includes("[DATE LINE]")) {
      const cleaned = trimmed.replace(/\[DATE LINE\]/g, "_____ day of __________________, 20___");
      lines.push({ type: "text", text: cleaned });
      continue;
    }
    if (trimmed.includes("[SIGNATURE LINE]")) {
      lines.push({ type: "text", text: trimmed.replace(/\[SIGNATURE LINE\]/g, "").trim() });
      lines.push({ type: "signature_line", label: "Signature" });
      continue;
    }

    // Skip duplicate notary text if we already rendered the block
    if (notaryRendered && (trimmed.includes("NOTARY ACKNOWLEDGMENT") || trimmed.includes("notary public, personally appeared"))) {
      continue;
    }

    const heading = isHeadingLine(trimmed, wasMarkdownHeading);

    lines.push({
      type: "text",
      text: trimmed,
      bold: heading,
      centered: heading,
    });
  }

  return lines;
}

/**
 * Groups parsed lines into layout blocks. Consecutive signature lines (optionally
 * separated by blanks) collapse into a single atomic signature block.
 */
function groupBlocks(parsed: ParsedLine[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < parsed.length) {
    const line = parsed[i];

    if (line.type === "signature_line") {
      const items: SignatureItem[] = [];
      let j = i;
      let pendingGap = false;
      while (j < parsed.length) {
        if (parsed[j].type === "signature_line") {
          items.push({ label: parsed[j].label || "Signature", gapBefore: pendingGap && items.length > 0 });
          pendingGap = false;
          j++;
        } else if (
          parsed[j].type === "blank" &&
          parsed[j + 1] &&
          parsed[j + 1].type === "signature_line"
        ) {
          // Absorb the blank so the run stays together, but remember it so the
          // separate groups (e.g. two witness blocks) keep breathing room.
          pendingGap = true;
          j++;
        } else {
          break;
        }
      }
      blocks.push({ kind: "signature_block", items });
      i = j;
      continue;
    }

    if (line.type === "notary_block") { blocks.push({ kind: "notary_block" }); i++; continue; }
    if (line.type === "blank") { blocks.push({ kind: "blank" }); i++; continue; }

    blocks.push({
      kind: "text",
      text: line.text || "",
      bold: Boolean(line.bold),
      centered: Boolean(line.centered),
    });
    i++;
  }

  return blocks;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function generatePDF(
  documentText: string,
  documentType: string,
  clientName: string,
  partnerName?: string,
  reviewingAttorney?: {
    name: string;
    barNumber: string;
    reviewedAt: string;
  },
  city?: string,
  partnerLogoUrl?: string | null
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Logo selection:
  //   partner client + partner uploaded logo → partner logo
  //   partner client + no logo → no logo (do NOT fallback to EstateVault)
  //   direct EstateVault client (no partnerName) → EstateVault logo
  let logoBytes: Buffer | null = null;
  if (partnerName) {
    if (partnerLogoUrl) {
      logoBytes = await fetchRemoteLogo(partnerLogoUrl);
    }
  } else {
    logoBytes = loadLogoBytes();
  }
  let logoImage: PDFImage | null = null;
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {
      try {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      } catch {
        logoImage = null;
      }
    }
  }

  const [pageWidth, pageHeight] = PageSizes.Letter;
  const margin = 72;
  const contentWidth = pageWidth - 2 * margin;
  const fontSize = 11;
  const lineHeight = fontSize * 1.6;
  const bottomLimit = margin;
  const navy = rgb(0.11, 0.21, 0.34);
  const title = TYPE_NAMES[documentType] || documentType;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const footerText = reviewingAttorney
    ? `Prepared by EstateVault | Reviewed by ${reviewingAttorney.name}, Bar No. ${reviewingAttorney.barNumber} | ${reviewingAttorney.reviewedAt}`
    : `Prepared by EstateVault${partnerName ? ` on behalf of ${partnerName}` : ""} | Document preparation service only | Not legal advice | Template Version 1.0.0-michigan`;

  let currentPage = pdfDoc.addPage(PageSizes.Letter);
  let yPos = pageHeight - margin;
  let pageNum = 0;

  function addNewPage() {
    currentPage = pdfDoc.addPage(PageSizes.Letter);
    yPos = pageHeight - margin - 20;
    pageNum++;
    addHeaderFooter();
  }

  function addHeaderFooter() {
    // Logo (top-left header)
    if (logoImage) {
      const logoH = 22;
      const logoW = (logoImage.width / logoImage.height) * logoH;
      currentPage.drawImage(logoImage, { x: margin, y: pageHeight - 36, width: logoW, height: logoH });
      currentPage.drawText(`${clientName}, ${title}`, { x: margin + logoW + 8, y: pageHeight - 30, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    } else {
      currentPage.drawText(`${clientName}, ${title}`, { x: margin, y: pageHeight - 30, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    }
    // Footer
    currentPage.drawText(footerText, { x: margin, y: 22, size: 6.5, font: helvetica, color: rgb(0.6, 0.6, 0.6) });
    currentPage.drawText(`Page ${pageNum}`, { x: pageWidth - margin - 30, y: 22, size: 7, font: helvetica, color: rgb(0.6, 0.6, 0.6) });
  }

  /** Remaining vertical space on the current page. */
  function spaceLeft() { return yPos - bottomLimit; }

  /** Moves to a new page when `needed` points will not fit. */
  function ensureSpace(needed: number) {
    if (needed > spaceLeft()) addNewPage();
  }

  function wrapLines(text: string, font: typeof timesRoman, size: number, width: number): string[] {
    const out: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (!word) continue;
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  }

  function drawWrappedText(
    text: string,
    font: typeof timesRoman,
    size: number,
    centered = false,
    opts: { x?: number; width?: number; leading?: number; color?: ReturnType<typeof rgb> } = {}
  ) {
    const x0 = opts.x ?? margin;
    const width = opts.width ?? contentWidth;
    const leading = opts.leading ?? lineHeight;
    const color = opts.color ?? rgb(0, 0, 0);
    for (const line of wrapLines(text, font, size, width)) {
      ensureSpace(leading);
      const x = centered ? x0 + (width - font.widthOfTextAtSize(line, size)) / 2 : x0;
      currentPage.drawText(line, { x, y: yPos, size, font, color });
      yPos -= leading;
    }
  }

  // ── Signature blocks: atomic, never split ──
  const SIG_LINE_HEIGHT = 8 + 12 + lineHeight * 0.6;

  const SIG_GROUP_GAP = 12;

  function signatureBlockHeight(items: SignatureItem[]) {
    const gaps = items.filter((it) => it.gapBefore).length;
    return items.length * SIG_LINE_HEIGHT + gaps * SIG_GROUP_GAP + 6;
  }

  function drawSignatureBlock(items: SignatureItem[]) {
    // The whole run moves to the next page rather than breaking across pages.
    ensureSpace(signatureBlockHeight(items));
    for (const { label, gapBefore } of items) {
      if (gapBefore) yPos -= SIG_GROUP_GAP;
      yPos -= 8;
      currentPage.drawLine({ start: { x: margin, y: yPos }, end: { x: margin + contentWidth * 0.55, y: yPos }, thickness: 0.75, color: rgb(0, 0, 0) });
      yPos -= 12;
      currentPage.drawText(label, { x: margin, y: yPos, size: 9, font: helvetica, color: rgb(0.35, 0.35, 0.35) });
      yPos -= lineHeight * 0.6;
    }
  }

  // ── Notary acknowledgment: atomic, never split ──
  const NOTARY_TEXT =
    "On this _____ day of __________________, 20_____, before me, the undersigned notary public, personally appeared the above-named person, known to me to be the person whose name is subscribed to the within instrument, and acknowledged that they executed the same for the purposes therein contained.";

  function notaryBodyLines() {
    return wrapLines(NOTARY_TEXT, timesRoman, 9, contentWidth - 32);
  }

  /** Exact rendered height of the notary block, derived from the same wrap used to draw it. */
  function notaryBlockHeight() {
    return 133 + notaryBodyLines().length * 11;
  }

  function drawNotaryBlock() {
    ensureSpace(notaryBlockHeight() + 8);

    const boxTop = yPos;

    yPos -= 20;
    const nTitle = "NOTARY ACKNOWLEDGMENT";
    currentPage.drawText(nTitle, {
      x: margin + (contentWidth - timesBold.widthOfTextAtSize(nTitle, 11)) / 2,
      y: yPos, size: 11, font: timesBold, color: rgb(0, 0, 0),
    });
    yPos -= 16;
    currentPage.drawText("STATE OF MICHIGAN", { x: margin + 16, y: yPos, size: 9, font: timesRoman });
    yPos -= 12;
    currentPage.drawText("COUNTY OF ____________________", { x: margin + 16, y: yPos, size: 9, font: timesRoman });
    yPos -= 16;

    for (const nl of notaryBodyLines()) {
      currentPage.drawText(nl, { x: margin + 16, y: yPos, size: 9, font: timesRoman });
      yPos -= 11;
    }

    yPos -= 6;
    currentPage.drawText("WITNESS my hand and official seal.", { x: margin + 16, y: yPos, size: 9, font: timesRoman });
    yPos -= 20;
    currentPage.drawLine({ start: { x: margin + 16, y: yPos }, end: { x: margin + 260, y: yPos }, thickness: 0.5, color: rgb(0, 0, 0) });
    yPos -= 11;
    currentPage.drawText("Notary Public, State of Michigan", { x: margin + 16, y: yPos, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    yPos -= 12;
    currentPage.drawText("My Commission Expires: ____________________", { x: margin + 16, y: yPos, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    yPos -= 10;
    currentPage.drawText("Acting in the County of: ____________________", { x: margin + 16, y: yPos, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    const boxBottom = yPos - 10;
    currentPage.drawRectangle({ x: margin, y: boxBottom, width: contentWidth, height: boxTop - boxBottom, borderColor: rgb(0, 0, 0), borderWidth: 0.75 });
    yPos = boxBottom - lineHeight;
  }

  // ── TITLE PAGE ──────────────────────────
  pageNum++;
  if (logoImage) {
    const logoH = 90;
    const logoW = (logoImage.width / logoImage.height) * logoH;
    currentPage.drawImage(logoImage, {
      x: (pageWidth - logoW) / 2,
      y: pageHeight - 180,
      width: logoW,
      height: logoH,
    });
  }
  yPos = pageHeight - 280;
  currentPage.drawText(title.toUpperCase(), { x: (pageWidth - timesBold.widthOfTextAtSize(title.toUpperCase(), 20)) / 2, y: yPos, size: 20, font: timesBold, color: navy });
  yPos -= 30;
  currentPage.drawText(clientName, { x: (pageWidth - timesRoman.widthOfTextAtSize(clientName, 14)) / 2, y: yPos, size: 14, font: timesRoman });
  yPos -= 50;
  currentPage.drawText(today, { x: (pageWidth - timesRoman.widthOfTextAtSize(today, 11)) / 2, y: yPos, size: 11, font: timesRoman, color: rgb(0.5, 0.5, 0.5) });
  yPos -= 60;
  const prepText = `Prepared for ${clientName} by ${partnerName || "EstateVault"}`;
  currentPage.drawText(prepText, { x: (pageWidth - helvetica.widthOfTextAtSize(prepText, 10)) / 2, y: yPos, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

  // ── BODY PAGES ──────────────────────────
  addNewPage();

  const blocks = groupBlocks(parseDocumentText(documentText));

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];

    if (block.kind === "blank") { yPos -= lineHeight * 0.4; continue; }
    if (block.kind === "signature_block") { drawSignatureBlock(block.items); continue; }
    if (block.kind === "notary_block") { drawNotaryBlock(); continue; }

    const font = block.bold ? timesBold : timesRoman;
    const size = block.bold ? 12 : fontSize;

    if (block.bold) {
      // Keep a title with at least two lines of what follows it.
      const headLines = wrapLines(block.text, font, size, contentWidth).length;
      ensureSpace(headLines * lineHeight + lineHeight * 2 + 6);
      yPos -= 4;
    }

    drawWrappedText(block.text, font, size, block.centered);
    if (block.bold) yPos -= 2;
  }

  // ── OPERATION OF THIS DOCUMENT (separate final page, after all signatures/notary) ──
  const sheet = getInstructionSheet(documentType);
  if (sheet) {
    addNewPage();
    yPos = pageHeight - margin - 20;

    currentPage.drawText(sheet.title, {
      x: (pageWidth - timesBold.widthOfTextAtSize(sheet.title, 16)) / 2,
      y: yPos, size: 16, font: timesBold, color: navy,
    });
    yPos -= 20;
    currentPage.drawText(sheet.subtitle, {
      x: (pageWidth - timesRoman.widthOfTextAtSize(sheet.subtitle, 11)) / 2,
      y: yPos, size: 11, font: timesRoman, color: rgb(0.4, 0.4, 0.4),
    });
    yPos -= 12;
    currentPage.drawLine({
      start: { x: margin + contentWidth * 0.3, y: yPos },
      end: { x: margin + contentWidth * 0.7, y: yPos },
      thickness: 0.75, color: rgb(0.79, 0.66, 0.3),
    });
    yPos -= 26;

    let stepNum = 0;
    for (const item of sheet.blocks) {
      if (item.type !== "step") stepNum = 0;

      if (item.type === "heading") {
        const upper = item.text.toUpperCase();
        ensureSpace(lineHeight * 3 + 10);
        yPos -= 6;
        currentPage.drawText(upper, {
          x: (pageWidth - timesBold.widthOfTextAtSize(upper, 12)) / 2,
          y: yPos, size: 12, font: timesBold, color: navy,
        });
        yPos -= lineHeight + 4;
        continue;
      }

      if (item.type === "paragraph") {
        drawWrappedText(item.text, item.bold ? timesBold : timesRoman, fontSize, false);
        yPos -= 6;
        continue;
      }

      if (item.type === "bullet") {
        const indent = 18;
        ensureSpace(lineHeight);
        currentPage.drawText("•", { x: margin + 4, y: yPos, size: fontSize, font: timesRoman });
        drawWrappedText(item.text, item.bold ? timesBold : timesRoman, fontSize, false, {
          x: margin + indent, width: contentWidth - indent,
        });
        yPos -= 4;
        continue;
      }

      // step
      stepNum++;
      const indent = 22;
      const label = `${stepNum}.`;
      const wrapped = wrapLines(item.text, timesRoman, fontSize, contentWidth - indent);
      ensureSpace(wrapped.length * lineHeight);
      currentPage.drawText(label, { x: margin + 4, y: yPos, size: fontSize, font: helveticaBold, color: navy });
      drawWrappedText(item.text, timesRoman, fontSize, false, {
        x: margin + indent, width: contentWidth - indent,
      });
      yPos -= 4;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
