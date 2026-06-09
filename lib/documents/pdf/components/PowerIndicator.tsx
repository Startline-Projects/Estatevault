import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface PowerIndicatorProps {
  powerName: string;
  status: "granted" | "not_granted";
  text: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 12,
    marginBottom: 4,
  },
  indicatorGranted: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 11,
    color: TOKENS.colors.greenRule,
    marginRight: 8,
  },
  indicatorNotGranted: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 11,
    color: TOKENS.colors.redRule,
    marginRight: 8,
  },
  powerName: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.navyDark,
    marginRight: 8,
  },
  badgeGranted: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.greenDark,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
  },
  badgeNotGranted: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.redDark,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
  },
  body: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    textAlign: "justify",
    lineHeight: 1.25,
    marginBottom: 10,
  },
});

/**
 * Renders one DPOA "power" with its granted / not-granted status badge and the
 * descriptive body paragraph below.
 *
 * Visual: filled "■" (green) or outlined "□" (red) indicator, then the power
 * name in Times-Bold, then a letter-spaced uppercase status badge. The body
 * paragraph follows in Times-Roman.
 */
export function PowerIndicator({ powerName, status, text }: PowerIndicatorProps): React.ReactElement {
  const isGranted = status === "granted";
  return (
    <>
      <View style={styles.row}>
        <Text style={isGranted ? styles.indicatorGranted : styles.indicatorNotGranted}>
          {isGranted ? "■" : "□"}
        </Text>
        <Text style={styles.powerName}>{powerName}.</Text>
        <Text style={isGranted ? styles.badgeGranted : styles.badgeNotGranted}>
          {isGranted ? "GRANTED." : "NOT GRANTED."}
        </Text>
      </View>
      {text ? <Text style={styles.body}>{text}</Text> : null}
    </>
  );
}

export default PowerIndicator;
