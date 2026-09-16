import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";
import { renderInlineText } from "./_inline";

/**
 * Shared black-and-white treatments for the emphasis blocks.
 *
 * Instrument pages carry no brand colour: a coloured background or rule is a
 * design element, and a legal instrument should read as a legal instrument.
 * Two conventional forms replace the coloured boxes:
 *
 *   - {@link LeadInNotice} — a plain paragraph opening with a bold uppercase
 *     lead-in. Used where the callout was drawing the eye but the emphasis is
 *     editorial rather than legally operative.
 *   - {@link BorderedNotice} — a plain black-bordered box with a bold uppercase
 *     heading. Reserved for notices where the emphasis is legally meaningful,
 *     such as a statutory warning that must be conspicuous.
 */

const styles = StyleSheet.create({
  leadInParagraph: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    textAlign: "justify",
    lineHeight: 1.25,
    marginTop: 10,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
  leadIn: {
    fontFamily: TOKENS.fonts.serifBold,
  },
  box: {
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderLeftWidth: TOKENS.borderWidth.ruleThin,
    borderRightWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.black,
    borderBottomColor: TOKENS.colors.black,
    borderLeftColor: TOKENS.colors.black,
    borderRightColor: TOKENS.colors.black,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  boxHeading: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
    textAlign: "center",
    marginBottom: 8,
  },
  boxBody: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    textAlign: "justify",
    lineHeight: 1.25,
  },
  row: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    lineHeight: 1.25,
    marginBottom: 2,
  },
});

/** Plain paragraph opening with a bold uppercase lead-in. */
export function LeadInNotice({ label, text }: { label: string; text: string }): React.ReactElement {
  return (
    <Text style={styles.leadInParagraph}>
      {label ? <Text style={styles.leadIn}>{`${label.toUpperCase()}.  `}</Text> : null}
      {renderInlineText(text)}
    </Text>
  );
}

/** Plain black-bordered box for legally meaningful notices. Never splits. */
export function BorderedNotice({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.box} wrap={false}>
      {label ? <Text style={styles.boxHeading}>{label.toUpperCase()}</Text> : null}
      {children}
    </View>
  );
}

export const noticeStyles = styles;
