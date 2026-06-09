import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface InfoBoxProps {
  rows: string[];
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
    borderLeftColor: TOKENS.colors.gold,
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  row: {
    fontFamily: TOKENS.fonts.sans,
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.navyDark,
    marginBottom: 6,
  },
  rowLast: {
    fontFamily: TOKENS.fonts.sans,
    fontSize: TOKENS.fontSize.bodySmall,
    color: TOKENS.colors.navyDark,
  },
  bold: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
  },
});

/**
 * Parse a single info-box row's `**label:**` markdown into a styled run.
 * Bold spans use Helvetica-bold; everything else inherits.
 */
function renderRow(row: string, key: number): React.ReactElement {
  const parts: React.ReactElement[] = [];
  const RE = /\*\*([^*]+?)\*\*/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = RE.exec(row)) !== null) {
    if (m.index > lastIdx) {
      parts.push(<Text key={`p${i++}`}>{row.slice(lastIdx, m.index)}</Text>);
    }
    parts.push(
      <Text key={`b${i++}`} style={styles.bold}>
        {m[1]}
      </Text>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < row.length) {
    parts.push(<Text key={`p${i++}`}>{row.slice(lastIdx)}</Text>);
  }
  if (parts.length === 0) parts.push(<Text key="p0">{row}</Text>);
  return <Text key={`row-${key}`}>{parts}</Text>;
}

/**
 * Navy-bordered cover info box — typically used on the title page to list the
 * client identifiers (testator, DOB, residence, marital status, etc.).
 *
 * Visual: pale-gray background, 1pt navy border on three sides, 4pt gold left
 * bar (the distinctive feature), 14pt inner padding, 6pt gap between rows.
 * Bold runs in row text (e.g. `**Testator:**`) render in Helvetica-bold.
 */
export function InfoBox({ rows }: InfoBoxProps): React.ReactElement {
  return (
    <View style={styles.box}>
      {rows.map((row, i) => (
        <View key={i} style={i === rows.length - 1 ? styles.rowLast : styles.row}>
          {renderRow(row, i)}
        </View>
      ))}
    </View>
  );
}

export default InfoBox;
