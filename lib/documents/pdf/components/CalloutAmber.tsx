import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface CalloutAmberProps {
  label: string;
  text: string;
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: TOKENS.colors.amberBg,
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.gold,
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderBottomColor: TOKENS.colors.gold,
    borderRightWidth: TOKENS.borderWidth.ruleThin,
    borderRightColor: TOKENS.colors.gold,
    borderLeftWidth: TOKENS.borderWidth.leftBar,
    borderLeftColor: TOKENS.colors.gold,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  label: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.navyDark,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
    marginBottom: 8,
  },
  body: {
    fontFamily: TOKENS.fonts.serifItalic,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.navyDark,
    textAlign: "justify",
    lineHeight: 1.25,
  },
});

/**
 * Amber-bordered callout used for general advisory notices.
 *
 * Visual: amber background, 1pt gold border on three sides, 4pt gold left bar,
 * uppercase Helvetica-bold label letter-spaced 2pt, italic Times-Italic body.
 */
export function CalloutAmber({ label, text }: CalloutAmberProps): React.ReactElement {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export default CalloutAmber;
