import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

const UNDERLINE = "__________________________";

const styles = StyleSheet.create({
  box: {
    backgroundColor: TOKENS.colors.white,
    // @react-pdf/renderer does not support borderStyle: "double". Per the spec,
    // we fall back to a 2pt solid navy border on all four sides; the heavier
    // weight still visually distinguishes the notary block from body content.
    borderTopWidth: TOKENS.borderWidth.ruleThick,
    borderBottomWidth: TOKENS.borderWidth.ruleThick,
    borderLeftWidth: TOKENS.borderWidth.ruleThick,
    borderRightWidth: TOKENS.borderWidth.ruleThick,
    borderTopColor: TOKENS.colors.navy,
    borderBottomColor: TOKENS.colors.navy,
    borderLeftColor: TOKENS.colors.navy,
    borderRightColor: TOKENS.colors.navy,
    padding: 18,
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.notaryLabel,
    color: TOKENS.colors.navyDark,
    letterSpacing: TOKENS.letterSpacing.articleHeader,
    marginBottom: 14,
  },
  rule: {
    width: "100%",
    borderBottomWidth: 0.5,
    borderBottomColor: TOKENS.colors.black,
    marginBottom: 4,
  },
  ruleLabel: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: 10,
    color: TOKENS.colors.black,
    marginBottom: 14,
  },
  twoColRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cellText: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: 10,
    color: TOKENS.colors.black,
  },
  goldDot: {
    color: TOKENS.colors.gold,
  },
  commission: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: 10,
    color: TOKENS.colors.black,
  },
});

/**
 * Fixed-visual notary acknowledgment block. The county and other notary fill-ins
 * are left as underline placeholders for manual completion at signing — the
 * resolver has already substituted any merge variables that appear within the
 * surrounding body text, so this component takes no props of its own.
 *
 * Visual: 2pt navy border (fallback for the spec's "double" style which is not
 * supported by @react-pdf/renderer), 18pt inner padding, "NOTARY ACKNOWLEDGMENT"
 * title in Helvetica-bold letter-spaced 3pt, signature rule, "Notary Public,
 * State of Michigan" line, county/acting-in row, and commission-expires line.
 */
export function NotaryBlock(): React.ReactElement {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>NOTARY ACKNOWLEDGMENT</Text>
      <View style={styles.rule} />
      <Text style={styles.ruleLabel}>Notary Public, State of Michigan</Text>
      <View style={styles.twoColRow}>
        <Text style={styles.cellText}>County of {UNDERLINE}</Text>
        <Text style={styles.cellText}>
          <Text style={styles.goldDot}> · </Text>
          Acting in {UNDERLINE} County, Michigan
        </Text>
      </View>
      <Text style={styles.commission}>My commission expires: {UNDERLINE}</Text>
    </View>
  );
}

export default NotaryBlock;
