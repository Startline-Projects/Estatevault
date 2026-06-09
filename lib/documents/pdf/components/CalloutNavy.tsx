import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface CalloutNavyProps {
  label: string;
  text: string;
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: TOKENS.colors.bgLight,
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.navy,
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderBottomColor: TOKENS.colors.navy,
    borderRightWidth: TOKENS.borderWidth.ruleThin,
    borderRightColor: TOKENS.colors.navy,
    borderLeftWidth: TOKENS.borderWidth.leftBar,
    borderLeftColor: TOKENS.colors.navy,
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
    // Per spec: navy callout body is NOT italic (uses Times-Roman regular)
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.navyDark,
    textAlign: "justify",
    lineHeight: 1.25,
  },
});

/**
 * Navy-bordered callout used for neutral procedural notes. Distinguished from
 * {@link CalloutAmber} by the pale-gray background, navy border colors, and
 * non-italic body text.
 */
export function CalloutNavy({ label, text }: CalloutNavyProps): React.ReactElement {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export default CalloutNavy;
