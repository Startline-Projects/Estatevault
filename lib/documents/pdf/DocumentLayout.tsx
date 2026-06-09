import React from "react";
import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "./tokens";
import { BrandedHeader, BrandedFooter } from "./components";
import type { BrandingContext } from "./document-config";

export interface DocumentLayoutProps {
  /** Header/footer branding (white-label vs. EstateVault, partner identity). */
  branding: BrandingContext;
  /** Client name shown in the footer left column. */
  clientFullName: string;
  /** Title shown in the centered header and the footer left column. */
  documentTitle: string;
  /** Template version string shown in the header right column. */
  templateVersion: string;
  /** Body content: the dispatched {@link DocumentRenderer} blocks. */
  children: React.ReactNode;
}

/**
 * Vertical breathing room reserved for the fixed header and footer rectangles.
 * Page padding is `pageMargin + reserved` on top and bottom so body content
 * doesn't overlap the fixed header / footer Views.
 */
const HEADER_RESERVED = 28;
const FOOTER_RESERVED = 36;

const styles = StyleSheet.create({
  page: {
    paddingTop: TOKENS.spacing.pageMargin + HEADER_RESERVED,
    paddingBottom: TOKENS.spacing.pageMargin + FOOTER_RESERVED,
    paddingLeft: TOKENS.spacing.pageMargin,
    paddingRight: TOKENS.spacing.pageMargin,
    fontFamily: TOKENS.fonts.serif,
    fontSize: TOKENS.fontSize.body,
    color: TOKENS.colors.black,
  },
  fixedHeader: {
    position: "absolute",
    top: TOKENS.spacing.pageMargin / 2,
    left: TOKENS.spacing.pageMargin,
    right: TOKENS.spacing.pageMargin,
  },
  fixedFooter: {
    position: "absolute",
    bottom: TOKENS.spacing.pageMargin / 2,
    left: TOKENS.spacing.pageMargin,
    right: TOKENS.spacing.pageMargin,
  },
});

/**
 * Base page layout — Document → Page with a fixed BrandedHeader at the top and
 * a fixed BrandedFooter at the bottom on every page. Body content (the
 * dispatched blocks from {@link DocumentRenderer}) flows in between and breaks
 * naturally across pages.
 *
 * The `fixed` prop on the header/footer Views causes @react-pdf/renderer to
 * repeat them on every page. Page padding reserves vertical space so the body
 * doesn't visually collide with them.
 */
export function DocumentLayout({
  branding,
  clientFullName,
  documentTitle,
  templateVersion,
  children,
}: DocumentLayoutProps): React.ReactElement {
  return (
    <Document
      title={documentTitle}
      author={branding.isWhiteLabel ? branding.partnerName ?? "EstateVault" : "EstateVault"}
      producer="EstateVault Document Pipeline"
    >
      <Page size="LETTER" style={styles.page}>
        <View fixed style={styles.fixedHeader}>
          <BrandedHeader
            isWhiteLabel={branding.isWhiteLabel}
            partnerLogoUrl={branding.partnerLogoUrl}
            documentTitle={documentTitle}
            templateVersion={templateVersion}
          />
        </View>
        {children}
        <View fixed style={styles.fixedFooter}>
          <BrandedFooter
            isWhiteLabel={branding.isWhiteLabel}
            partnerName={branding.partnerName}
            clientFullName={clientFullName}
            documentTitle={documentTitle}
          />
        </View>
      </Page>
    </Document>
  );
}

export default DocumentLayout;
