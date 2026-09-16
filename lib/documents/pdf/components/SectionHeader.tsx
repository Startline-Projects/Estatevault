import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface SectionHeaderProps {
  number: string;
  title: string;
}

const styles = StyleSheet.create({
  container: {
    marginTop: TOKENS.spacing.sectionBefore,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
  text: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.sectionHeader,
    color: TOKENS.colors.black,
    textAlign: "center",
  },
});

/**
 * Section heading, centered bold serif — e.g. "Section 1.1.  Identification of
 * Testator."
 *
 * The gold left bar was branded styling and has been removed; instrument body
 * pages use traditional centered headings only.
 */
export function SectionHeader({ number, title }: SectionHeaderProps): React.ReactElement {
  return (
    <View style={styles.container} wrap={false}>
      <Text style={styles.text}>
        Section {number}.{title ? `  ${title}` : ""}
      </Text>
    </View>
  );
}

export default SectionHeader;
