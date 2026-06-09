import React from "react";
import { Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";
import { renderInlineText, splitParagraphs } from "./_inline";

export interface BodyTextProps {
  text: string;
}

const styles = StyleSheet.create({
  paragraph: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    textAlign: "justify",
    lineHeight: 1.25,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
});

/**
 * Renders a body paragraph (or sequence of paragraphs separated by blank lines).
 *
 * Visual: Times-Roman 11pt, justified, 1.25 line height, 8pt paragraph spacing.
 * Inline `**bold**` and `*italic*` markers are honored via {@link renderInlineText}.
 */
export function BodyText({ text }: BodyTextProps): React.ReactElement {
  const paragraphs = splitParagraphs(text);
  // If for some reason there are no paragraphs, fall back to a single empty
  // Text so the parent still receives a valid React element.
  if (paragraphs.length === 0) {
    return <Text style={styles.paragraph} />;
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.paragraph}>
          {renderInlineText(p)}
        </Text>
      ))}
    </>
  );
}

export default BodyText;
