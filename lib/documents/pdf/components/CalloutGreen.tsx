import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface CalloutGreenProps {
  label: string;
  text: string;
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: TOKENS.colors.greenBg,
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.greenRule,
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderBottomColor: TOKENS.colors.greenRule,
    borderRightWidth: TOKENS.borderWidth.ruleThin,
    borderRightColor: TOKENS.colors.greenRule,
    borderLeftWidth: TOKENS.borderWidth.leftBar,
    borderLeftColor: TOKENS.colors.greenRule,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  label: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.greenDark,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
    marginBottom: 8,
  },
  body: {
    fontFamily: TOKENS.fonts.serifItalic,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.greenDark,
    textAlign: "justify",
    lineHeight: 1.25,
  },
});

/**
 * Green-bordered callout used for affirmations such as ATTORNEY REVIEWED &
 * APPROVED and the HIPAA compliance checklist.
 */
export function CalloutGreen({ label, text }: CalloutGreenProps): React.ReactElement {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export default CalloutGreen;
