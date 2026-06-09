import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface CalloutRedProps {
  label: string;
  text: string;
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: TOKENS.colors.redBg,
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.redRule,
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderBottomColor: TOKENS.colors.redRule,
    borderRightWidth: TOKENS.borderWidth.ruleThin,
    borderRightColor: TOKENS.colors.redRule,
    borderLeftWidth: TOKENS.borderWidth.leftBar,
    borderLeftColor: TOKENS.colors.redRule,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  label: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.redDark,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
    marginBottom: 8,
  },
  body: {
    fontFamily: TOKENS.fonts.serifItalic,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.redDark,
    textAlign: "justify",
    lineHeight: 1.25,
  },
});

/**
 * Red-bordered callout reserved for critical statutory warnings — e.g. the
 * PAD witness-disqualification notice required by MCL 700.5506(4).
 */
export function CalloutRed({ label, text }: CalloutRedProps): React.ReactElement {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export default CalloutRed;
