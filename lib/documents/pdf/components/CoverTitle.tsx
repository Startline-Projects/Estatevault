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
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.coverTitle,
    color: TOKENS.colors.black,
    letterSpacing: TOKENS.letterSpacing.coverTitle,
  },
});

/**
 * Centered cover-page title (e.g. "LAST WILL AND TESTAMENT").
 *
 * Centered bold serif in black — the caption of a conventional legal
 * instrument. Brand colours belong on cover/wrapper pages, not on the face of
 * the instrument itself.
 */
export function CoverTitle({ text }: CoverTitleProps): React.ReactElement {
  return <Text style={styles.title}>{text}</Text>;
}

export default CoverTitle;
