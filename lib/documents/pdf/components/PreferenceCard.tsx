import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface PreferenceCardProps {
  label: string;
  text: string;
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: TOKENS.colors.tealBg,
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.tealRule,
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderBottomColor: TOKENS.colors.tealRule,
    borderRightWidth: TOKENS.borderWidth.ruleThin,
    borderRightColor: TOKENS.colors.tealRule,
    borderLeftWidth: TOKENS.borderWidth.leftBar,
    borderLeftColor: TOKENS.colors.tealRule,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  labelLine: {
    marginBottom: 8,
  },
  labelPrefix: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 9,
    color: TOKENS.colors.tealDark,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
  },
  labelDot: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 9,
    color: TOKENS.colors.gold,
  },
  labelText: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 9,
    color: TOKENS.colors.tealDark,
  },
  body: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.navyDark,
    textAlign: "justify",
    lineHeight: 1.25,
  },
});

/**
 * Teal-bordered "MY ELECTED PREFERENCE" card used in the Patient Advocate
 * Designation and Funeral Representative Designation to highlight the user's
 * chosen treatment / disposition preference.
 *
 * The label area renders as: "MY ELECTED PREFERENCE  ·  {label}" with the
 * middle dot in gold, all in Helvetica-bold 9pt.
 */
export function PreferenceCard({ label, text }: PreferenceCardProps): React.ReactElement {
  return (
    <View style={styles.box}>
      <Text style={styles.labelLine}>
        <Text style={styles.labelPrefix}>MY ELECTED PREFERENCE</Text>
        <Text style={styles.labelDot}> · </Text>
        <Text style={styles.labelText}>{label}</Text>
      </Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

export default PreferenceCard;
