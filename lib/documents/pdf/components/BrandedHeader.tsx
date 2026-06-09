import React from "react";
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface BrandedHeaderProps {
  isWhiteLabel: boolean;
  partnerLogoUrl?: string;
  documentTitle: string;
  templateVersion: string;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  left: {
    width: "25%",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  center: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "center",
  },
  right: {
    width: "25%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
  },
  estatevaultMark: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 9,
    color: TOKENS.colors.navy,
    letterSpacing: TOKENS.letterSpacing.sectionLabel,
  },
  partnerLogoPlaceholder: {
    fontFamily: TOKENS.fonts.sans,
    fontSize: 9,
    color: TOKENS.colors.grayText,
  },
  partnerLogo: {
    height: 18,
    objectFit: "contain",
  },
  titleText: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 9,
    color: TOKENS.colors.navy,
    letterSpacing: TOKENS.letterSpacing.articleHeader,
    textAlign: "center",
  },
  versionPrefix: {
    fontFamily: TOKENS.fonts.sans,
    fontStyle: "italic",
    fontSize: 9,
    color: TOKENS.colors.grayText,
  },
  versionNumber: {
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: 9,
    color: TOKENS.colors.navy,
  },
  goldRule: {
    width: "100%",
    borderBottomWidth: TOKENS.borderWidth.ruleThin,
    borderBottomColor: TOKENS.colors.gold,
    marginTop: 6,
  },
});

/**
 * Per-page branded header. Three-column layout:
 *   - Left:   EstateVault wordmark, or the partner logo when white-labeled.
 *   - Center: the current document title (e.g. "LAST WILL AND TESTAMENT").
 *   - Right:  template version, e.g. "v1.1.0".
 *
 * Followed by a 1pt gold rule and 8pt of breathing room before page content.
 *
 * Note: partnerLogoUrl handling falls back to a "[PARTNER LOGO]" text placeholder
 * when isWhiteLabel is true but no URL is provided. Real image embedding will
 * be exercised end-to-end in Part 3c.
 */
export function BrandedHeader({
  isWhiteLabel,
  partnerLogoUrl,
  documentTitle,
  templateVersion,
}: BrandedHeaderProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.left}>
          {isWhiteLabel ? (
            partnerLogoUrl ? (
              <Image src={partnerLogoUrl} style={styles.partnerLogo} />
            ) : (
              <Text style={styles.partnerLogoPlaceholder}>[PARTNER LOGO]</Text>
            )
          ) : (
            <Text style={styles.estatevaultMark}>ESTATEVAULT</Text>
          )}
        </View>
        <View style={styles.center}>
          <Text style={styles.titleText}>{documentTitle}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.versionPrefix}>v</Text>
          <Text style={styles.versionNumber}>{templateVersion}</Text>
        </View>
      </View>
      <View style={styles.goldRule} />
    </View>
  );
}

export default BrandedHeader;
