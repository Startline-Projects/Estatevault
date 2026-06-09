import React from "react";
import { Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface CoverTitleProps {
  text: string;
}

const styles = StyleSheet.create({
  title: {
    marginTop: 40,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.coverTitle,
    color: TOKENS.colors.navy,
    letterSpacing: TOKENS.letterSpacing.coverTitle,
  },
});

/**
 * Centered cover-page title (e.g. "LAST WILL AND TESTAMENT").
 *
 * Visual: 40pt top margin, centered Helvetica-bold 28pt navy with 4pt letter
 * spacing. Wraps cleanly if the text overflows the centered column.
 */
export function CoverTitle({ text }: CoverTitleProps): React.ReactElement {
  return <Text style={styles.title}>{text}</Text>;
}

export default CoverTitle;
