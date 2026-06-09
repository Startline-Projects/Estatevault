import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface SectionHeaderProps {
  number: string;
  title: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: TOKENS.spacing.sectionBefore,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
  bar: {
    width: TOKENS.borderWidth.leftBar,
    backgroundColor: TOKENS.colors.gold,
  },
  text: {
    paddingLeft: 12,
    color: TOKENS.colors.navy,
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.sectionHeader,
  },
});

/**
 * Gold-left-bar section marker, e.g. "Section 1.1.  Identification of Testator."
 *
 * Visual: 4pt gold left bar (full text height), 12pt gap, then navy
 * Helvetica-bold 11pt. Two spaces sit between the section number and the title.
 */
export function SectionHeader({ number, title }: SectionHeaderProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.bar} />
      <Text style={styles.text}>
        Section {number}.{title ? `  ${title}` : ""}
      </Text>
    </View>
  );
}

export default SectionHeader;
