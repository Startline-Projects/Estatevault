/*
 * Editable DOCX generation for attorney review — styled to match the PDF
 * (lib/documents/generate-pdf.ts): Times New Roman, Letter + 1" margins, logo
 * title page, running header/footer with page numbers, ruled signature lines,
 * bordered notary block. Built from the SAME parsed text the PDF uses.
 *
 * Editable on purpose — sealed to the review attorney only, never sent to clients.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  AlignmentType,
  BorderStyle,
  WidthType,
  TabStopType,
  TabStopPosition,
  type IImageOptions,
} from "docx";
import fs from "fs";
import path from "path";
import { parseDocumentText, TYPE_NAMES, type ParsedLine } from "./generate-pdf";

const FONT = "Times New Roman";
const SANS = "Arial";
const NAVY = "1C3557";
const GRAY = "808080";
const DGRAY = "595959";
const BODY_PT = 22; // 11pt in half-points
const HEADING_PT = 24; // 12pt
// Letter content width at 1" margins = 6.5in. 1in = 1440 twips → 9360 twips.
const CONTENT_TWIPS = 9360;

// ── logo ────────────────────────────────────────────────────────────────
let cachedLogo: Buffer | null = null;
function loadLogoBytes(): Buffer | null {
  if (cachedLogo) return cachedLogo;
  try {
    cachedLogo = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
    return cachedLogo;
  } catch {
    return null;
  }
}

async function fetchRemoteLogo(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function imageType(buf: Buffer): "png" | "jpg" | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return null;
}

// Read intrinsic pixel size so the logo keeps aspect ratio. PNG IHDR / JPEG SOF.
function imageSize(buf: Buffer, type: "png" | "jpg"): { w: number; h: number } {
  try {
    if (type === "png") {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    // JPEG: scan for SOF0/2 marker.
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
  } catch { /* fall through */ }
  return { w: 300, h: 100 };
}

function logoImageRun(buf: Buffer, targetHeightPx: number): ImageRun | null {
  const type = imageType(buf);
  if (!type) return null;
  const { w, h } = imageSize(buf, type);
  const width = Math.round((w / h) * targetHeightPx);
  return new ImageRun({ type, data: buf, transformation: { width, height: targetHeightPx } } as IImageOptions);
}

// ── building blocks ───────────────────────────────────────────────────────
function run(text: string, opts: { bold?: boolean; size?: number; color?: string; font?: string } = {}) {
  return new TextRun({
    text,
    font: opts.font || FONT,
    size: opts.size ?? BODY_PT,
    bold: opts.bold,
    color: opts.color,
  });
}

function signatureParagraphs(label: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200 },
      // Ruled line ~55% of content width via a bottom-bordered, right-indented paragraph.
      indent: { right: Math.round(CONTENT_TWIPS * 0.45) },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      children: [run(" ")],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [run(label, { font: SANS, size: 18, color: DGRAY })] }),
  ];
}

function notaryTable(): Table {
  const notaryText =
    "On this _____ day of __________________, 20_____, before me, the undersigned notary public, personally appeared the above-named person, known to me to be the person whose name is subscribed to the within instrument, and acknowledged that they executed the same for the purposes therein contained.";
  const cellChildren = [
    new Paragraph({ spacing: { after: 80 }, children: [run("NOTARY ACKNOWLEDGMENT", { bold: true })] }),
    new Paragraph({ children: [run("STATE OF MICHIGAN")] }),
    new Paragraph({ spacing: { after: 80 }, children: [run("COUNTY OF ____________________")] }),
    new Paragraph({ spacing: { after: 80 }, children: [run(notaryText)] }),
    new Paragraph({ spacing: { after: 120 }, children: [run("WITNESS my hand and official seal.")] }),
    new Paragraph({ spacing: { before: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 1 } }, indent: { right: Math.round(CONTENT_TWIPS * 0.5) }, children: [run(" ")] }),
    new Paragraph({ children: [run("Notary Public, State of Michigan", { font: SANS, size: 16, color: DGRAY })] }),
    new Paragraph({ children: [run("My Commission Expires: ____________________", { font: SANS, size: 16, color: DGRAY })] }),
    new Paragraph({ children: [run("Acting in the County of: ____________________", { font: SANS, size: 16, color: DGRAY })] }),
  ];
  const edge = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge },
    rows: [new TableRow({ children: [new TableCell({ margins: { top: 120, bottom: 120, left: 160, right: 160 }, children: cellChildren })] })],
  });
}

function lineToBlocks(line: ParsedLine): (Paragraph | Table)[] {
  if (line.type === "blank") return [new Paragraph({ children: [] })];
  if (line.type === "signature_line") return signatureParagraphs(line.label || "Signature");
  if (line.type === "notary_block") return [notaryTable()];

  const text = line.text || "";
  const alignment = line.centered ? AlignmentType.CENTER : AlignmentType.LEFT;
  if (line.bold) {
    return [new Paragraph({ alignment, spacing: { before: 160, after: 80 }, children: [run(text, { bold: true, size: HEADING_PT, color: NAVY })] })];
  }
  return [new Paragraph({ alignment, spacing: { after: 60 }, children: [run(text)] })];
}

// ── main ────────────────────────────────────────────────────────────────
export async function generateDOCX(
  documentText: string,
  documentType: string,
  clientName: string,
  partnerName?: string,
  partnerLogoUrl?: string | null,
): Promise<Buffer> {
  const title = TYPE_NAMES[documentType] || documentType;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Logo selection mirrors the PDF: partner client → partner logo (or none);
  // direct EstateVault client → bundled logo.
  let logoBytes: Buffer | null = null;
  if (partnerName) {
    if (partnerLogoUrl) logoBytes = await fetchRemoteLogo(partnerLogoUrl);
  } else {
    logoBytes = loadLogoBytes();
  }

  const footerText = `Prepared by EstateVault${partnerName ? ` on behalf of ${partnerName}` : ""} | Document preparation service only | Not legal advice | Template Version 1.0.0-michigan`;

  // Running header: small logo + "Name, Title".
  const headerChildren: TextRun[] = [run(`${clientName}, ${title}`, { font: SANS, size: 16, color: GRAY })];
  const headerLogo = logoBytes ? logoImageRun(logoBytes, 16) : null;
  const header = new Header({
    children: [new Paragraph({ children: headerLogo ? [headerLogo, run("  ", { font: SANS, size: 16 }), ...headerChildren] : headerChildren })],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          run(footerText, { font: SANS, size: 13, color: GRAY }),
          new TextRun({ text: "\tPage ", font: SANS, size: 14, color: GRAY }),
          new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 14, color: GRAY }),
        ],
      }),
    ],
  });

  // Title page.
  const titlePage: (Paragraph | Table)[] = [];
  for (let i = 0; i < 6; i++) titlePage.push(new Paragraph({ children: [] }));
  const bigLogo = logoBytes ? logoImageRun(logoBytes, 90) : null;
  if (bigLogo) titlePage.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [bigLogo] }));
  titlePage.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(title.toUpperCase(), { bold: true, size: 40, color: NAVY })] }));
  titlePage.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(clientName, { size: 28 })] }));
  titlePage.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(today, { size: BODY_PT, color: GRAY })] }));
  titlePage.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Prepared for ${clientName} by ${partnerName || "EstateVault"}`, { font: SANS, size: 18, color: GRAY })] }));
  titlePage.push(new Paragraph({ children: [new PageBreak()] }));

  const body = parseDocumentText(documentText).flatMap(lineToBlocks);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // Letter, twips
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [...titlePage, ...body],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
