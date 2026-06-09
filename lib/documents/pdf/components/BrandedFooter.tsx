import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface BrandedFooterProps {
  isWhiteLabel: boolean;
  partnerName?: string;
  clientFullName: string;
  documentTitle: string;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    paddingTop: 4,
    borderTopWidth: TOKENS.borderWidth.ruleThin,
    borderTopColor: TOKENS.colors.grayBorder,
  },
  firstRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
  },
  leftCell: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  clientName: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.footer,
    color: TOKENS.colors.navy,
  },
  dot: {
    fontFamily: TOKENS.fonts.sans,
    fontSize: TOKENS.fontSize.footer,
    color: TOKENS.colors.grayText,
  },
  docTitle: {
    fontFamily: TOKENS.fonts.sans,
    fontSize: TOKENS.fontSize.footer,
    color: TOKENS.colors.grayText,
  },
  rightCell: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  pageLabel: {
    fontFamily: TOKENS.fonts.sans,
    fontSize: TOKENS.fontSize.footer,
    color: TOKENS.colors.grayText,
  },
  pageNumber: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.footer,
    color: TOKENS.colors.navy,
  },
  disclaimer: {
    textAlign: "center",
    fontFamily: TOKENS.fonts.sans,
    fontStyle: "italic",
    fontSize: 7,
    color: TOKENS.colors.grayText,
  },
});

/**
 * Per-page branded footer. Two rows:
 *   - Top: client name + document title on the left, "Page N" on the right.
 *   - Bottom: a centered, italicized legal disclaimer. Text varies by whether
 *     the document was generated through a white-label partner.
 *
 * Page numbering uses @react-pdf's `render` prop pattern, which provides
 * `pageNumber` (1-indexed) at layout time.
 */
export function BrandedFooter({
  isWhiteLabel,
  partnerName,
  clientFullName,
  documentTitle,
}: BrandedFooterProps): React.ReactElement {
  const disclaimer = isWhiteLabel
    ? `Document preparation service only · Not legal advice · No attorney-client relationship created · Document prepared through ${partnerName ?? ""} · Powered by EstateVault`
    : "Document preparation service only · Not legal advice · No attorney-client relationship created · EstateVault Technologies LLC";

  return (
    <View style={styles.container}>
      <View style={styles.firstRow}>
        <View style={styles.leftCell}>
          <Text style={styles.clientName}>{clientFullName}</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.docTitle}>{documentTitle}</Text>
        </View>
        <View style={styles.rightCell}>
          <Text style={styles.pageLabel}>Page </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber }) => `${pageNumber}`}
          />
        </View>
      </View>
      <Text style={styles.disclaimer}>{disclaimer}</Text>
    </View>
  );
}

export default BrandedFooter;
