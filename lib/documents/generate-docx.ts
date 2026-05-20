/*
 * Editable DOCX generation for attorney review.
 * Built from the SAME parsed document text the PDF uses, so the attorney edits
 * the exact content that was generated. Word-friendly: real headings, paragraphs
 * and underline "blanks" for signature/notary lines.
 *
 * This file produces an editable artifact ON PURPOSE — it is sealed to the
 * review attorney only and never delivered to the client.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { parseDocumentText, TYPE_NAMES, type ParsedLine } from "./generate-pdf";

const UNDERLINE = "_________________________________________";

function signatureParagraph(label: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: UNDERLINE })] }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: label, size: 18, color: "595959" })],
    }),
  ];
}

function notaryParagraphs(): Paragraph[] {
  const notaryText =
    "On this _____ day of __________________, 20_____, before me, the undersigned notary public, personally appeared the above-named person, known to me to be the person whose name is subscribed to the within instrument, and acknowledged that they executed the same for the purposes therein contained.";
  return [
    new Paragraph({
      spacing: { before: 300, after: 120 },
      children: [new TextRun({ text: "NOTARY ACKNOWLEDGMENT", bold: true })],
    }),
    new Paragraph({ children: [new TextRun({ text: "STATE OF MICHIGAN" })] }),
    new Paragraph({ children: [new TextRun({ text: "COUNTY OF ____________________" })] }),
    new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: notaryText })] }),
    new Paragraph({ children: [new TextRun({ text: "WITNESS my hand and official seal." })] }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: UNDERLINE })] }),
    new Paragraph({ children: [new TextRun({ text: "Notary Public, State of Michigan", size: 18, color: "595959" })] }),
    new Paragraph({ children: [new TextRun({ text: "My Commission Expires: ____________________", size: 18, color: "595959" })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Acting in the County of: ____________________", size: 18, color: "595959" })] }),
  ];
}

function lineToParagraphs(line: ParsedLine): Paragraph[] {
  if (line.type === "blank") return [new Paragraph({ children: [] })];
  if (line.type === "signature_line") return signatureParagraph(line.label || "Signature");
  if (line.type === "notary_block") return notaryParagraphs();

  const text = line.text || "";
  const centered = line.centered ? { alignment: AlignmentType.CENTER } : {};
  if (line.bold) {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
        ...centered,
        children: [new TextRun({ text, bold: true })],
      }),
    ];
  }
  return [new Paragraph({ ...centered, children: [new TextRun({ text })] })];
}

export async function generateDOCX(
  documentText: string,
  documentType: string,
  clientName: string,
  partnerName?: string,
): Promise<Buffer> {
  const title = TYPE_NAMES[documentType] || documentType;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const titleBlock: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: clientName })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: today, color: "808080" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: `Prepared for ${clientName} by ${partnerName || "EstateVault"}`, color: "808080", size: 18 })],
    }),
  ];

  const body = parseDocumentText(documentText).flatMap(lineToParagraphs);

  const doc = new Document({
    sections: [{ children: [...titleBlock, ...body] }],
  });

  const bytes = await Packer.toBuffer(doc);
  return Buffer.from(bytes);
}
