/**
 * Parses fully-resolved template text (the output of `renderTemplate()`) into a
 * structured stream of {@link DocumentBlock}s that the PDF component renderer
 * (Part 3c) walks to produce the final document.
 *
 * The parser is pure text-in, structured-out: no PDF generation, no styling,
 * no React. It does not know or care what tokens or fonts will eventually be
 * applied — only that the input has been resolved to plain text plus a small
 * vocabulary of structural markers introduced by the template author.
 *
 * Marker vocabulary recognized by this parser:
 *   `# X`                          → cover_title
 *   `#sub X`                       → cover_subtitle
 *   `## ARTICLE <roman> — <title>` → article_header
 *   `### Section <id> — <title>`   → section_header
 *   `- X`                          → bullet
 *   `[PAGE_BREAK]`                 → page_break
 *   `[NOTARY_BLOCK]`               → notary_block (self-closing)
 *   `[SIGNATURE label="X"]`        → signature (canonical form)
 *   `[SIGNATURE] X`                → signature (alternate form used by extract.js)
 *   `[INFO_BOX] ... [/INFO_BOX]`             → info_box
 *   `[CALLOUT_AMBER label="X"] ... [/CALLOUT_AMBER]`     → callout_amber
 *   `[CALLOUT_NAVY  label="X"] ... [/CALLOUT_NAVY]`      → callout_navy
 *   `[CALLOUT_GREEN label="X"] ... [/CALLOUT_GREEN]`     → callout_green
 *   `[CALLOUT_RED   label="X"] ... [/CALLOUT_RED]`       → callout_red
 *   `[PREFERENCE_CARD label="X"] ... [/PREFERENCE_CARD]` → preference_card
 *   `[BOLD_STATUTORY] ... [/BOLD_STATUTORY]` → bold_statutory
 *   `**PowerName.** GRANTED.`      → power_granted (body = next paragraph)
 *   `**PowerName.** NOT GRANTED.`  → power_not_granted (body = next paragraph)
 *
 * Anything else collapses into `body` blocks: consecutive non-empty lines form
 * one body block; blank lines and any structural marker terminate it.
 */

/**
 * One node in the parsed document. Discriminated by `type`; every consumer
 * should narrow on `type` before reading branch-specific fields.
 */
export type DocumentBlock =
  | { type: "cover_title"; text: string }
  | { type: "cover_subtitle"; text: string }
  | { type: "article_header"; number: string; title: string }
  | { type: "section_header"; number: string; title: string }
  | { type: "body"; text: string }
  | { type: "bullet"; text: string }
  | { type: "info_box"; rows: string[] }
  | { type: "callout_amber"; label: string; text: string }
  | { type: "callout_navy"; label: string; text: string }
  | { type: "callout_green"; label: string; text: string }
  | { type: "callout_red"; label: string; text: string }
  | { type: "preference_card"; label: string; text: string }
  | { type: "power_granted"; powerName: string; text: string }
  | { type: "power_not_granted"; powerName: string; text: string }
  | { type: "signature"; label: string }
  | { type: "notary_block" }
  | { type: "page_break" }
  | { type: "bold_statutory"; text: string };

/** Map of opening-tag name → resulting block kind for multi-line wrapper tags. */
const CALLOUT_KIND: Record<string, DocumentBlock["type"]> = {
  CALLOUT_AMBER: "callout_amber",
  CALLOUT_NAVY: "callout_navy",
  CALLOUT_GREEN: "callout_green",
  CALLOUT_RED: "callout_red",
  PREFERENCE_CARD: "preference_card",
};

/** Tag names for the simple (no-label) multi-line wrappers. */
const SIMPLE_WRAPPERS: Record<string, "info_box" | "bold_statutory"> = {
  INFO_BOX: "info_box",
  BOLD_STATUTORY: "bold_statutory",
};

/**
 * Internal scratch state for an open multi-line block we are accumulating
 * content into until we see its matching `[/TAG]`. Discriminated by `kind`.
 */
type OpenBlock =
  | { kind: "callout_amber"; label: string; openLine: number; openTag: string; content: string[] }
  | { kind: "callout_navy"; label: string; openLine: number; openTag: string; content: string[] }
  | { kind: "callout_green"; label: string; openLine: number; openTag: string; content: string[] }
  | { kind: "callout_red"; label: string; openLine: number; openTag: string; content: string[] }
  | { kind: "preference_card"; label: string; openLine: number; openTag: string; content: string[] }
  | { kind: "info_box"; label: ""; openLine: number; openTag: string; content: string[] }
  | { kind: "bold_statutory"; label: ""; openLine: number; openTag: string; content: string[] };

/** Mapping from OpenBlock kind to the close-tag name it requires. */
const CLOSE_TAG_FOR_KIND: Record<OpenBlock["kind"], string> = {
  callout_amber: "CALLOUT_AMBER",
  callout_navy: "CALLOUT_NAVY",
  callout_green: "CALLOUT_GREEN",
  callout_red: "CALLOUT_RED",
  preference_card: "PREFERENCE_CARD",
  info_box: "INFO_BOX",
  bold_statutory: "BOLD_STATUTORY",
};

/**
 * Return true if `trimmed` is *any* recognized structural marker line — used to
 * (a) terminate a power-indicator body collection and (b) detect nesting attempts
 * inside an open multi-line block.
 */
function isStructuralLine(trimmed: string): boolean {
  if (trimmed === "[PAGE_BREAK]") return true;
  if (trimmed === "[NOTARY_BLOCK]" || trimmed === "[/NOTARY_BLOCK]") return true;
  if (/^\[SIGNATURE(\s|\])/.test(trimmed)) return true;
  if (/^\[\/?(?:CALLOUT_(?:AMBER|NAVY|GREEN|RED)|PREFERENCE_CARD|INFO_BOX|BOLD_STATUTORY)(?:\s|\])/.test(trimmed)) return true;
  if (/^# /.test(trimmed)) return true;
  if (/^#sub /.test(trimmed)) return true;
  if (/^## ARTICLE\b/.test(trimmed)) return true;
  if (/^### Section\b/.test(trimmed)) return true;
  if (/^- /.test(trimmed)) return true;
  return false;
}

/**
 * Emit a completed multi-line block into `out`. For info_box, only non-empty
 * trimmed lines are kept as rows. For callouts and preference_card, content is
 * joined with single spaces into one paragraph. For bold_statutory the same.
 */
function emitOpenBlock(open: OpenBlock, out: DocumentBlock[]): void {
  switch (open.kind) {
    case "info_box": {
      const rows = open.content.map((l) => l.trim()).filter((l) => l.length > 0);
      out.push({ type: "info_box", rows });
      return;
    }
    case "bold_statutory": {
      const text = open.content.map((l) => l.trim()).filter(Boolean).join(" ");
      out.push({ type: "bold_statutory", text });
      return;
    }
    case "callout_amber":
    case "callout_navy":
    case "callout_green":
    case "callout_red":
    case "preference_card": {
      const text = open.content.map((l) => l.trim()).filter(Boolean).join(" ");
      // `open.kind` is exactly the DocumentBlock `type` literal we need.
      out.push({ type: open.kind, label: open.label, text } as DocumentBlock);
      return;
    }
  }
}

/**
 * Parse fully-resolved template text into a stream of {@link DocumentBlock}s
 * that downstream PDF components can render directly.
 *
 * @param renderedText - The output of `renderTemplate()` (no `{{...}}` tokens).
 * @returns An ordered list of structured blocks.
 * @throws If a multi-line wrapper tag is left unclosed, if a closing tag has
 *   no matching opener, or if structural markers are nested inside one another.
 */
export function parseRenderedText(renderedText: string): DocumentBlock[] {
  const lines = renderedText.split(/\r?\n/);
  const blocks: DocumentBlock[] = [];

  /** Accumulator for `body` blocks; flushed at blank lines and structural markers. */
  let bodyBuffer: string[] = [];
  /** Currently open multi-line wrapper, if any. */
  let open: OpenBlock | null = null;

  const flushBody = () => {
    if (bodyBuffer.length === 0) return;
    blocks.push({ type: "body", text: bodyBuffer.join("\n") });
    bodyBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // ─── Inside an open multi-line block: accumulate, or close on its closing tag ───
    if (open) {
      // Match the close tag we're waiting for.
      const expectedClose = `[/${CLOSE_TAG_FOR_KIND[open.kind]}]`;
      if (trimmed === expectedClose) {
        emitOpenBlock(open, blocks);
        open = null;
        continue;
      }
      // Any other structural marker inside is a nesting attempt — disallowed.
      if (isStructuralLine(trimmed)) {
        throw new Error(
          `Nested structural markers not supported. At line ${i + 1} ("${trimmed}"), ` +
            `inside ${open.openTag} block opened at line ${open.openLine}.`
        );
      }
      // Any other closing tag mid-block is a mismatch.
      if (/^\[\//.test(trimmed) && trimmed !== "[/NOTARY_BLOCK]") {
        throw new Error(
          `Unmatched closing tag at line ${i + 1}: "${trimmed}". ` +
            `Expected "${expectedClose}" to close the ${open.openTag} block opened at line ${open.openLine}.`
        );
      }
      open.content.push(raw);
      continue;
    }

    // ─── Blank line: terminate current body buffer, nothing emitted ───
    if (trimmed === "") {
      flushBody();
      continue;
    }

    // ─── Cover title: "# X" (single hash + space) ───
    if (/^# /.test(trimmed)) {
      flushBody();
      blocks.push({ type: "cover_title", text: trimmed.slice(2).trim() });
      continue;
    }

    // ─── Cover subtitle: "#sub X" ───
    if (/^#sub /.test(trimmed)) {
      flushBody();
      blocks.push({ type: "cover_subtitle", text: trimmed.slice(5).trim() });
      continue;
    }

    // ─── Article header: "## ARTICLE I — TITLE" (split on em-dash, en-dash, or hyphen-spaces) ───
    let m = trimmed.match(/^## ARTICLE\s+([IVXLCDM]+)(?:\s*[—–\-]\s*(.+))?$/);
    if (m) {
      flushBody();
      blocks.push({ type: "article_header", number: m[1], title: (m[2] || "").trim() });
      continue;
    }

    // ─── Section header: "### Section <id> — <title>" (title optional) ───
    m = trimmed.match(/^### Section\s+(\S+?)(?:\s*[—–\-]\s*(.+))?$/);
    if (m) {
      flushBody();
      blocks.push({ type: "section_header", number: m[1], title: (m[2] || "").trim() });
      continue;
    }

    // ─── Bullet: "- X" ───
    if (/^- /.test(trimmed)) {
      flushBody();
      blocks.push({ type: "bullet", text: trimmed.slice(2).trim() });
      continue;
    }

    // ─── Page break ───
    if (trimmed === "[PAGE_BREAK]") {
      flushBody();
      blocks.push({ type: "page_break" });
      continue;
    }

    // ─── Notary block: self-closing per spec. Tolerate `[/NOTARY_BLOCK]` as no-op
    //     so wrapper-style usage (extract.js output) parses cleanly. ───
    if (trimmed === "[NOTARY_BLOCK]") {
      flushBody();
      blocks.push({ type: "notary_block" });
      continue;
    }
    if (trimmed === "[/NOTARY_BLOCK]") {
      flushBody();
      continue;
    }

    // ─── Signature: canonical `[SIGNATURE label="X"]` or alternate `[SIGNATURE] X` ───
    let sig = trimmed.match(/^\[SIGNATURE\s+label="([^"]*)"\]$/);
    if (sig) {
      flushBody();
      blocks.push({ type: "signature", label: sig[1] });
      continue;
    }
    sig = trimmed.match(/^\[SIGNATURE\](?:\s+(.+))?$/);
    if (sig) {
      flushBody();
      blocks.push({ type: "signature", label: (sig[1] || "").trim() });
      continue;
    }

    // ─── Multi-line wrappers: open a new OpenBlock and accumulate from next line ───
    const calloutOpen = trimmed.match(
      /^\[(CALLOUT_(?:AMBER|NAVY|GREEN|RED)|PREFERENCE_CARD)(?:\s+label="([^"]*)")?\]$/
    );
    if (calloutOpen) {
      flushBody();
      const tagName = calloutOpen[1];
      const label = calloutOpen[2] || "";
      const kind = CALLOUT_KIND[tagName] as
        | "callout_amber"
        | "callout_navy"
        | "callout_green"
        | "callout_red"
        | "preference_card";
      open = { kind, label, openLine: i + 1, openTag: trimmed, content: [] };
      continue;
    }
    const simpleOpen = trimmed.match(/^\[(INFO_BOX|BOLD_STATUTORY)\]$/);
    if (simpleOpen) {
      flushBody();
      const kind = SIMPLE_WRAPPERS[simpleOpen[1]];
      open = { kind, label: "", openLine: i + 1, openTag: trimmed, content: [] };
      continue;
    }

    // ─── Bare closing tag at top level — unmatched ───
    if (/^\[\/(?:CALLOUT_(?:AMBER|NAVY|GREEN|RED)|PREFERENCE_CARD|INFO_BOX|BOLD_STATUTORY)\]$/.test(trimmed)) {
      throw new Error(`Unmatched closing tag at line ${i + 1}: "${trimmed}" has no matching opening tag.`);
    }

    // ─── Power indicator: `**PowerName.** GRANTED.` or `... NOT GRANTED.` ───
    //     Body text is the following non-empty lines until blank or structural marker.
    const powerMatch = trimmed.match(/^\*\*(.+?)\*\*\s+(NOT GRANTED|GRANTED)\.?$/);
    if (powerMatch) {
      flushBody();
      const powerName = powerMatch[1].replace(/\.+\s*$/, "").trim();
      const isGranted = powerMatch[2] === "GRANTED";
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const peek = lines[j].trim();
        if (peek === "") break;
        if (isStructuralLine(peek)) break;
        bodyLines.push(peek);
        j++;
      }
      i = j - 1; // outer loop will advance past collected body lines
      blocks.push(
        isGranted
          ? { type: "power_granted", powerName, text: bodyLines.join(" ").trim() }
          : { type: "power_not_granted", powerName, text: bodyLines.join(" ").trim() }
      );
      continue;
    }

    // ─── Default: accumulate into the current body block ───
    bodyBuffer.push(trimmed);
  }

  // End-of-input cleanup: any open multi-line block is an error.
  if (open) {
    throw new Error(
      `Unclosed ${open.openTag} block opened at line ${open.openLine}. ` +
        `Expected matching "[/${CLOSE_TAG_FOR_KIND[open.kind]}]" before end of input.`
    );
  }
  flushBody();

  return blocks;
}
