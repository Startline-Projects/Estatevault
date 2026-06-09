import React from "react";
import { Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface CoverSubtitleProps {
  text: string;
}

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: 4,
    textAlign: "center",
    fontFamily: TOKENS.fonts.sans,
    fontSize: TOKENS.fontSize.coverSubtitle,
    color: TOKENS.colors.grayText,
    letterSpacing: 3,
  },
});

/**
 * Centered cover-page subtitle (e.g. "OF JANE DOE").
 *
 * Visual: centered Helvetica 12pt gray with 3pt letter spacing. Text is
 * automatically uppercased so authors can write naturally in the template.
 */
export function CoverSubtitle({ text }: CoverSubtitleProps): React.ReactElement {
  return <Text style={styles.subtitle}>{text.toUpperCase()}</Text>;
}

export default CoverSubtitle;
