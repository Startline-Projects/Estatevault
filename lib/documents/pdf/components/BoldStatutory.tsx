import React from "react";
import { Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";
import { renderInlineText, splitParagraphs } from "./_inline";

export interface BoldStatutoryProps {
  text: string;
}

const styles = StyleSheet.create({
  paragraph: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.navyDark,
    textAlign: "justify",
    lineHeight: 1.3,
    marginBottom: 10,
  },
});

/**
 * Bold statutory paragraph — Times-Bold body used for statutory pronouncements
 * (e.g. Article III of the Funeral Representative Designation, Article IV of
 * the Guardian Nomination). Inline `**bold**` / `*italic*` markers are still
 * honored within, via {@link renderInlineText}.
 */
export function BoldStatutory({ text }: BoldStatutoryProps): React.ReactElement {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return <Text style={styles.paragraph} />;
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

export default BoldStatutory;
