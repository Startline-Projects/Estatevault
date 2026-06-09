import React from "react";
import { View } from "@react-pdf/renderer";
import { parseRenderedText, type DocumentBlock } from "./parser";
import { DOCUMENT_CONFIG, type DocumentType, type BrandingContext } from "./document-config";
import { DocumentLayout } from "./DocumentLayout";
import {
  ArticleHeader,
  SectionHeader,
  BodyText,
  BulletItem,
  InfoBox,
  CalloutAmber,
  CalloutNavy,
  CalloutGreen,
  CalloutRed,
  PreferenceCard,
  PowerIndicator,
  SignatureBlock,
  NotaryBlock,
  CoverTitle,
  CoverSubtitle,
  BoldStatutory,
} from "./components";

export interface DocumentRendererProps {
  /** Fully-resolved template text — the output of `renderTemplate()`. */
  renderedText: string;
  /** Which document this is (drives header title, version, etc.). */
  documentType: DocumentType;
  /** White-label vs. EstateVault branding and partner identity. */
  branding: BrandingContext;
  /** Used by the BrandedFooter to label the page. */
  clientFullName: string;
}

/**
 * Map a single parsed {@link DocumentBlock} to its rendered React element.
 *
 * The switch is **exhaustive**: every variant of `DocumentBlock` is handled,
 * and the trailing `never` assignment is a compile-time guard — adding a new
 * variant to the union without updating this function is a type error.
 */
function dispatchBlock(block: DocumentBlock, index: number): React.ReactElement {
  switch (block.type) {
    case "cover_title":
      return <CoverTitle key={index} text={block.text} />;
    case "cover_subtitle":
      return <CoverSubtitle key={index} text={block.text} />;
    case "article_header":
      return <ArticleHeader key={index} number={block.number} title={block.title} />;
    case "section_header":
      return <SectionHeader key={index} number={block.number} title={block.title} />;
    case "body":
      return <BodyText key={index} text={block.text} />;
    case "bullet":
      return <BulletItem key={index} text={block.text} />;
    case "info_box":
      return <InfoBox key={index} rows={block.rows} />;
    case "callout_amber":
      return <CalloutAmber key={index} label={block.label} text={block.text} />;
    case "callout_navy":
      return <CalloutNavy key={index} label={block.label} text={block.text} />;
    case "callout_green":
      return <CalloutGreen key={index} label={block.label} text={block.text} />;
    case "callout_red":
      return <CalloutRed key={index} label={block.label} text={block.text} />;
    case "preference_card":
      return <PreferenceCard key={index} label={block.label} text={block.text} />;
    case "power_granted":
      return (
        <PowerIndicator key={index} powerName={block.powerName} status="granted" text={block.text} />
      );
    case "power_not_granted":
      return (
        <PowerIndicator key={index} powerName={block.powerName} status="not_granted" text={block.text} />
      );
    case "signature":
      return <SignatureBlock key={index} label={block.label} />;
    case "notary_block":
      return <NotaryBlock key={index} />;
    case "page_break":
      return <View key={index} break />;
    case "bold_statutory":
      return <BoldStatutory key={index} text={block.text} />;
    default: {
      // Exhaustiveness guard. If a new DocumentBlock variant is added without
      // a matching case above, TypeScript flags this assignment.
      const _exhaustive: never = block;
      throw new Error(`Unhandled block type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Top-level document renderer. Glues together the three Phase B Part 3 layers:
 *   1. **Parser** (`parseRenderedText`) — turns the resolver's text output into
 *      a typed stream of {@link DocumentBlock}s.
 *   2. **Components** (`./components/`) — each block kind has a styled
 *      component that renders it via `@react-pdf/renderer` primitives.
 *   3. **Layout** (`DocumentLayout`) — wraps the body in a Letter-sized Page
 *      with a fixed branded header/footer that repeat on every page.
 *
 * The result is a React element ready to feed into `pdf(...).toBuffer()` or
 * `renderToBuffer(...)` for serialization.
 */
export function DocumentRenderer({
  renderedText,
  documentType,
  branding,
  clientFullName,
}: DocumentRendererProps): React.ReactElement {
  const config = DOCUMENT_CONFIG[documentType];
  const blocks = parseRenderedText(renderedText);

  return (
    <DocumentLayout
      branding={branding}
      clientFullName={clientFullName}
      documentTitle={config.title}
      templateVersion={config.version}
    >
      {blocks.map((b, i) => dispatchBlock(b, i))}
    </DocumentLayout>
  );
}

export default DocumentRenderer;
