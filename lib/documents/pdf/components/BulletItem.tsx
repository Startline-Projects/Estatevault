import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";
import { renderInlineText } from "./_inline";

export interface BulletItemProps {
  text: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginLeft: 18,
    marginBottom: 4,
  },
  bullet: {
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.navy,
    width: 8 + 6, // bullet + ~6pt of glyph room
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
    textAlign: "justify",
    lineHeight: 1.25,
  },
});

/**
 * Indented bullet list item, e.g. an enumerated child or beneficiary.
 *
 * Visual: 18pt left indent, navy "•" bullet, 8pt gap, then Times-Roman 11pt
 * body text with the same `**bold**` / `*italic*` inline handling as BodyText.
 */
export function BulletItem({ text }: BulletItemProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.text}>{renderInlineText(text)}</Text>
    </View>
  );
}

export default BulletItem;
