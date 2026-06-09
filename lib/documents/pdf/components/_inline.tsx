import React from "react";
import { Text } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

/**
 * Parses inline markdown-style emphasis (`**bold**` and `*italic*`) within a
 * single paragraph of text and returns an array of <Text> elements that can be
 * nested inside a parent <Text>. Children inherit the parent's font and color
 * properties; only the font family is overridden for bold/italic runs.
 *
 * Shared by `BodyText`, `BulletItem`, and `BoldStatutory` — and any future
 * component that renders body-style prose.
 *
 * @param text - The raw paragraph text. May contain `**...**` and `*...*` runs.
 * @returns An array of <Text> children with plain / bold / italic runs.
 */
export function renderInlineText(text: string): React.ReactElement[] {
  const TOKEN_RE = /(\*\*[^*]+?\*\*|\*[^*]+?\*)/g;
  const out: React.ReactElement[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  // Reset regex state for safety; this function is called in tight loops.
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      out.push(<Text key={`p${key++}`}>{text.slice(lastIdx, m.index)}</Text>);
    }
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <Text key={`b${key++}`} style={{ fontFamily: TOKENS.fonts.serifBold }}>
          {tok.slice(2, -2)}
        </Text>
      );
    } else {
      out.push(
        <Text key={`i${key++}`} style={{ fontFamily: TOKENS.fonts.serifItalic }}>
          {tok.slice(1, -1)}
        </Text>
      );
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < text.length) {
    out.push(<Text key={`p${key++}`}>{text.slice(lastIdx)}</Text>);
  }
  if (out.length === 0) {
    // Empty input — return a single empty Text so the parent has at least one child.
    out.push(<Text key="p0" />);
  }
  return out;
}

/**
 * Split a body string into paragraph chunks at double newlines. Single newlines
 * within a chunk are collapsed to spaces — they're typically just wrap artifacts
 * from how the parser captured consecutive body lines, not intentional breaks.
 *
 * @param text - The body text from a {@link import("../parser").DocumentBlock} `body` block.
 * @returns An array of paragraph strings (always at least one element).
 */
export function splitParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((p) => p.replace(/\n+/g, " ").trim()).filter(Boolean);
}
