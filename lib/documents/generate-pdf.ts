/*
 * DOCUMENT GENERATION — ATTORNEY SUPERVISED
 * Template Version: 1.0.0-michigan
 * Attorney Approval Date: [TO BE FILLED]
 * Approved By: [TO BE FILLED]
 */

import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";

const TYPE_NAMES: Record<string, string> = {
  will: "Last Will and Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Patient Advocate Designation",
};

interface ParsedLine {
  type: "text" | "blank" | "signature_line" | "notary_block";
  text?: string;
  label?: string;
  bold?: boolean;
  centered?: boolean;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^---+$/gm, "")
    .replace(/^===+$/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDocumentText(rawText: string): ParsedLine[] {
  const text = stripMarkdown(rawText);
  const lines: ParsedLine[] = [];
  const rawLines = text.split("\n");
  let notaryRendered = false;

  for (const raw of rawLines) {
    const trimmed = raw.trim();

    if (!trimmed) { lines.push({ type: "blank" }); continue; }

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
      lines.push({ type: "text", text: trimmed.replace(/\[SIGNATURE LINE\]/g, "") });
      lines.push({ type: "signature_line", label: "Signature" });
      continue;
    }

    // Skip duplicate notary text if we already rendered the block
    if (notaryRendered && (trimmed.includes("NOTARY ACKNOWLEDGMENT") || trimmed.includes("notary public, personally appeared"))) {
      continue;
    }

    const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80 && !/^[_\s]+$/.test(trimmed);
    const isArticle = /^ARTICLE\s+[IVXLC0-9]+/i.test(trimmed);

    lines.push({
      type: "text",
      text: trimmed,
      bold: isAllCaps || isArticle,
      centered: (isAllCaps && trimmed.length < 50) || isArticle,
    });
  }

  return lines;
}

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
  city?: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const [pageWidth, pageHeight] = PageSizes.Letter;
  const margin = 72;
  const contentWidth = pageWidth - 2 * margin;
  const fontSize = 11;
  const lineHeight = fontSize * 1.6;
  const title = TYPE_NAMES[documentType] || documentType;
const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const footerText = reviewingAttorney
    ? `Prepared by EstateVault | Reviewed by ${reviewingAttorney.name}, Bar #${reviewingAttorney.barNumber} | ${reviewingAttorney.reviewedAt}`
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
    // Header
    currentPage.drawText(`${clientName} \u2014 ${title}`, { x: margin, y: pageHeight - 30, size: 8, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    // Footer
    currentPage.drawText(footerText, { x: margin, y: 22, size: 6.5, font: helvetica, color: rgb(0.6, 0.6, 0.6) });
    currentPage.drawText(`Page ${pageNum}`, { x: pageWidth - margin - 30, y: 22, size: 7, font: helvetica, color: rgb(0.6, 0.6, 0.6) });
  }

  function checkPage(needed: number) {
    if (yPos < margin + needed) addNewPage();
  }

  function drawWrappedText(text: string, font: typeof timesRoman, size: number, centered: boolean = false) {
    const words = text.split(" ");
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > contentWidth && line) {
        checkPage(20);
        const x = centered ? (pageWidth - font.widthOfTextAtSize(line, size)) / 2 : margin;
        currentPage.drawText(line, { x, y: yPos, size, font, color: rgb(0, 0, 0) });
        yPos -= lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      checkPage(20);
      const x = centered ? (pageWidth - font.widthOfTextAtSize(line, size)) / 2 : margin;
      currentPage.drawText(line, { x, y: yPos, size, font, color: rgb(0, 0, 0) });
      yPos -= lineHeight;
    }
  }

  function drawSignatureLine(label: string) {
    checkPage(40);
    yPos -= 8;
    currentPage.drawLine({ start: { x: margin, y: yPos }, end: { x: margin + contentWidth * 0.55, y: yPos }, thickness: 0.75, color: rgb(0, 0, 0) });
    yPos -= 12;
    currentPage.drawText(label, { x: margin, y: yPos, size: 9, font: helvetica, color: rgb(0.35, 0.35, 0.35) });
    yPos -= lineHeight * 0.6;
  }

  function drawNotaryBlock() {
    checkPage(200);
    const boxTop = yPos;
    const boxHeight = 180;

    yPos -= 20;
    currentPage.drawText("NOTARY ACKNOWLEDGMENT", { x: margin + 16, y: yPos, size: 11, font: timesBold, color: rgb(0, 0, 0) });
    yPos -= 16;
    currentPage.drawText("STATE OF MICHIGAN", { x: margin + 16, y: yPos, size: 9, font: timesRoman });
    yPos -= 12;
    currentPage.drawText("COUNTY OF ____________________", { x: margin + 16, y: yPos, size: 9, font: timesRoman });
    yPos -= 16;

    const notaryText = "On this _____ day of __________________, 20_____, before me, the undersigned notary public, personally appeared the above-named person, known to me to be the person whose name is subscribed to the within instrument, and acknowledged that they executed the same for the purposes therein contained.";
    const notaryWords = notaryText.split(" ");
    let nl = "";
    for (const w of notaryWords) {
      const test = nl ? `${nl} ${w}` : w;
      if (timesRoman.widthOfTextAtSize(test, 9) > contentWidth - 32) {
        currentPage.drawText(nl, { x: margin + 16, y: yPos, size: 9, font: timesRoman });
        yPos -= 11;
        nl = w;
      } else { nl = test; }
    }
    if (nl) { currentPage.drawText(nl, { x: margin + 16, y: yPos, size: 9, font: timesRoman }); yPos -= 11; }

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
  yPos = pageHeight - 280;
  currentPage.drawText(title.toUpperCase(), { x: (pageWidth - timesBold.widthOfTextAtSize(title.toUpperCase(), 20)) / 2, y: yPos, size: 20, font: timesBold, color: rgb(0.11, 0.21, 0.34) });
  yPos -= 30;
  currentPage.drawText(clientName, { x: (pageWidth - timesRoman.widthOfTextAtSize(clientName, 14)) / 2, y: yPos, size: 14, font: timesRoman });
  yPos -= 50;
  currentPage.drawText(today, { x: (pageWidth - timesRoman.widthOfTextAtSize(today, 11)) / 2, y: yPos, size: 11, font: timesRoman, color: rgb(0.5, 0.5, 0.5) });
  yPos -= 60;
  const prepText = `Prepared for ${clientName} by ${partnerName || "EstateVault"}`;
  currentPage.drawText(prepText, { x: (pageWidth - helvetica.widthOfTextAtSize(prepText, 10)) / 2, y: yPos, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });

  // ── BODY PAGES ──────────────────────────
  addNewPage();

  const parsed = parseDocumentText(documentText);

  for (const line of parsed) {
    if (line.type === "blank") { yPos -= lineHeight * 0.4; continue; }

    if (line.type === "signature_line") {
      drawSignatureLine(line.label || "Signature");
      continue;
    }

    if (line.type === "notary_block") {
      drawNotaryBlock();
      continue;
    }

    // Text
    const font = line.bold ? timesBold : timesRoman;
    const size = line.bold ? 12 : fontSize;

    if (line.bold) yPos -= 4;
    drawWrappedText(line.text || "", font, size, line.centered || false);
    if (line.bold) yPos -= 2;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
