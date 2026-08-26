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

/** Decodes a PDF hex string (<48656C6C6F>) into characters. */
function decodeHexString(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}

/** 2D affine matrix as PDF stores it: [a b c d e f]. */
type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** PDF `cm` concatenation: result = m × ctm. */
function multiply(m: Matrix, ctm: Matrix): Matrix {
  return [
    m[0] * ctm[0] + m[1] * ctm[2],
    m[0] * ctm[1] + m[1] * ctm[3],
    m[2] * ctm[0] + m[3] * ctm[2],
    m[2] * ctm[1] + m[3] * ctm[3],
    m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
    m[4] * ctm[1] + m[5] * ctm[3] + ctm[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Walks a content stream and records every text-showing operation with its
 * device-space position.
 *
 * Handles both writers this repo produces:
 *   - pdf-lib  — positions with `Tm`, shows text with `(lit) Tj` / `<hex> Tj`
 *   - react-pdf — positions with nested `q`/`cm`/`Q` transforms and shows text
 *     with kerned `[<hex> n <hex>] TJ` arrays
 *
 * Tracking the graphics-state stack is what makes react-pdf output readable at
 * all: its `Tm` is a constant, and all real positioning lives in the CTM.
 */
function extractFromContent(content: string, page: number, pageWidth: number, pageHeight: number): DrawnText[] {
  const out: DrawnText[] = [];

  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];
  let tm: Matrix = IDENTITY;
  let size = 0;

  const NUM = "[-+]?[\\d.]+";
  const opRe = new RegExp(
    [
      "(q)\\b",
      "(Q)\\b",
      `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(cm|Tm)\\b`,
      `\\/[A-Za-z0-9_.+-]+\\s+(${NUM})\\s+Tf`,
      "\\[((?:[^\\[\\]]|\\\\.)*)\\]\\s*TJ",
      "<([0-9A-Fa-f\\s]*)>\\s*Tj",
      "(\\((?:[^()\\\\]|\\\\.)*\\))\\s*Tj",
    ].join("|"),
    "g",
  );

  let m: RegExpExecArray | null;
  while ((m = opRe.exec(content)) !== null) {
    if (m[1]) { stack.push(ctm); continue; }
    if (m[2]) { ctm = stack.pop() ?? IDENTITY; continue; }

    if (m[9]) {
      const mat: Matrix = [+m[3], +m[4], +m[5], +m[6], +m[7], +m[8]];
      if (m[9] === "cm") ctm = multiply(mat, ctm);
      else tm = mat;
      continue;
    }

    if (m[10] !== undefined) { size = parseFloat(m[10]); continue; }

    let text: string | null = null;
    if (m[11] !== undefined) {
      // TJ array: concatenate the string pieces, ignore the kerning numbers.
      text = Array.from(m[11].matchAll(/<([0-9A-Fa-f\s]*)>|\(((?:[^()\\]|\\.)*)\)/g))
        .map((piece) => (piece[1] !== undefined ? decodeHexString(piece[1]) : unescapePdfString(piece[2] ?? "")))
        .join("");
    } else if (m[12] !== undefined) {
      text = decodeHexString(m[12]);
    } else if (m[13] !== undefined) {
      text = unescapePdfString(m[13].slice(1, -1));
    }

    if (text === null || !text.trim()) continue;

    const full = multiply(tm, ctm);
    const [dx, dy] = apply(full, 0, 0);
    out.push({ page, text, x: dx, y: dy < 0 ? dy + pageHeight : dy, size, pageWidth });
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
      all.push(...extractFromContent(decodeStream(s), idx + 1, width, page.getHeight()));
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

/**
 * Joins text runs that belong to the same visual line.
 *
 * react-pdf emits a styled line as several runs (e.g. "ARTICLE " then "I"), so
 * matching on whole-line text requires stitching runs that share a page and a
 * baseline back together. `x` of the joined line is the leftmost run's x.
 */
export function toLines(drawn: DrawnText[], yTolerance = 1.5): DrawnText[] {
  const lines: DrawnText[] = [];
  const sorted = [...drawn].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  for (const run of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === run.page && Math.abs(last.y - run.y) <= yTolerance) {
      // A gap wider than roughly a space means a column break, not a word break.
      const gap = run.x - (last.x + last.text.length * last.size * 0.5);
      last.text += (gap > last.size ? "  " : "") + run.text;
      last.size = Math.max(last.size, run.size);
      continue;
    }
    lines.push({ ...run });
  }

  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }));
}
