import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface DocumentHeaderProps {
  text: string;
}

const styles = StyleSheet.create({
  container: {
    marginTop: TOKENS.spacing.articleBefore,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
  text: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.articleHeader,
    color: TOKENS.colors.black,
    letterSpacing: TOKENS.letterSpacing.articleHeader,
    textAlign: "center",
  },
});

/**
 * A non-article document heading — ATTESTATION, SELF-PROVING AFFIDAVIT, NOTARY
 * ACKNOWLEDGMENT, SCHEDULE A, OPERATION OF THIS DOCUMENT, and so on.
 *
 * These previously fell through the parser into body text and rendered with a
 * literal "## " prefix. Styled to match {@link ArticleHeader}: centered bold
 * serif caps, no brand marks.
 */
export function DocumentHeader({ text }: DocumentHeaderProps): React.ReactElement {
  return (
    <View style={styles.container} wrap={false}>
      <Text style={styles.text}>{text.toUpperCase()}</Text>
    </View>
  );
}

export default DocumentHeader;
