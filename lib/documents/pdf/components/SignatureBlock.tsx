import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface SignatureBlockProps {
  label: string;
}

// Letter page width (612pt) minus 72pt margins on each side ≈ 468pt of content
// area. Subtract a small inset so the rule visually matches the typeset width
// without bumping the page edge. Empirically: 460pt.
const RULE_WIDTH = 460;

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  rule: {
    width: RULE_WIDTH,
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.colors.black,
    marginBottom: 4,
  },
  label: {
    fontFamily: TOKENS.fonts.serifItalic,
    fontSize: 9,
    color: TOKENS.colors.grayText,
  },
});

/**
 * Signature line with an italic gray label below (e.g. "Testator",
 * "Witness One — Printed Name and Address").
 *
 * Visual: 20pt top margin, 460pt-wide 0.5pt rule, 4pt gap, 9pt Times-Italic
 * gray label.
 */
export function SignatureBlock({ label }: SignatureBlockProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.rule} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default SignatureBlock;
