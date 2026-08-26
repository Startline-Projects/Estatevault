/*
 * Reads text back out of a generated PDF so formatting can be verified against the
 * real rendered bytes rather than against the input string.
 *
 * pdf-lib writes uncompressed content streams, so the page content can be read
 * directly and the text-showing operators parsed out with their coordinates.
 */

import { PDFDocument } from "pdf-lib";
import zlib from "zlib";

export interface DrawnText {
  page: number;      // 1-indexed
  text: string;
  x: number;
  y: number;
  size: number;
  pageWidth: number;
}

function decodeStream(stream: any): string {
  const raw: Uint8Array = stream.getContents();
  // pdf-lib Flate-encodes content streams; inflate first, fall back to raw bytes.
  try {
    return zlib.inflateSync(Buffer.from(raw)).toString("latin1");
  } catch {
    return Buffer.from(raw).toString("latin1");
  }
}

/** Undoes PDF literal-string escaping. */
function unescapePdfString(s: string): string {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_m, g) => {
    switch (g) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "b": return "\b";
      case "f": return "\f";
      case "(": return "(";
      case ")": return ")";
      case "\\": return "\\";
      default: return String.fromCharCode(parseInt(g, 8));
    }
  });
}

/** Decodes a PDF hex string (<48656C6C6F>) written by pdf-lib for standard fonts. */
function decodeHexString(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}

/**
 * Walks a content stream tracking Tf (size), Tm/Td (position) and Tj (show text).
 * pdf-lib emits hex strings for standard fonts and literal strings elsewhere, so
 * both forms are handled.
 */
function extractFromContent(content: string, page: number, pageWidth: number): DrawnText[] {
  const out: DrawnText[] = [];
  let x = 0;
  let y = 0;
  let size = 0;

  const opRe = new RegExp(
    [
      "<([0-9A-Fa-f\\s]*)>\\s*Tj",                                  // hex string
      "\\((?:[^()\\\\]|\\\\.)*\\)\\s*Tj",                              // literal string
      "\\/[A-Za-z0-9_.+-]+\\s+([\\d.]+)\\s+Tf",                         // font + size
      "([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+Tm",
      "([-\\d.]+)\\s+([-\\d.]+)\\s+Td",
    ].join("|"),
    "g"
  );

  let m: RegExpExecArray | null;
  while ((m = opRe.exec(content)) !== null) {
    const tok = m[0];
    if (m[2] !== undefined) {
      size = parseFloat(m[2]);
    } else if (m[8] !== undefined) {
      x = parseFloat(m[7]);
      y = parseFloat(m[8]);
    } else if (m[9] !== undefined) {
      x += parseFloat(m[9]);
      y += parseFloat(m[10]);
    } else if (m[1] !== undefined) {
      const text = decodeHexString(m[1]);
      if (text.trim()) out.push({ page, text, x, y, size, pageWidth });
    } else if (tok.endsWith("Tj")) {
      const lit = tok.slice(tok.indexOf("(") + 1, tok.lastIndexOf(")"));
      const text = unescapePdfString(lit);
      if (text.trim()) out.push({ page, text, x, y, size, pageWidth });
    }
  }

  return out;
}

/** Returns every piece of text drawn into the PDF, with page and coordinates. */
export async function extractDrawnText(pdfBytes: Buffer | Uint8Array): Promise<DrawnText[]> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const all: DrawnText[] = [];

  pages.forEach((page, idx) => {
    const width = page.getWidth();
    const node: any = page.node;
    const contents = node.Contents();
    const streams: any[] = [];

    if (!contents) return;
    if (typeof contents.asArray === "function") {
      for (const ref of contents.asArray()) {
        streams.push(doc.context.lookup(ref));
      }
    } else {
      streams.push(contents);
    }

    for (const s of streams) {
      if (!s || typeof s.getContents !== "function") continue;
      all.push(...extractFromContent(decodeStream(s), idx + 1, width));
    }
  });

  return all;
}

/** All rendered text of the document, joined. */
export function fullText(drawn: DrawnText[]): string {
  return drawn.map((d) => d.text).join("\n");
}

/** Text drawn on one page. */
export function pageText(drawn: DrawnText[], page: number): string {
  return drawn.filter((d) => d.page === page).map((d) => d.text).join("\n");
}
