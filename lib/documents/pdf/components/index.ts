// Single import surface for the PDF component library. Downstream code should
// import from "lib/documents/pdf/components" rather than from individual files,
// so the file layout can evolve without forcing churn in the Document renderer.

export { ArticleHeader, type ArticleHeaderProps } from "./ArticleHeader";
export { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
export { BodyText, type BodyTextProps } from "./BodyText";
export { BulletItem, type BulletItemProps } from "./BulletItem";
export { InfoBox, type InfoBoxProps } from "./InfoBox";
export { CalloutAmber, type CalloutAmberProps } from "./CalloutAmber";
export { CalloutNavy, type CalloutNavyProps } from "./CalloutNavy";
export { CalloutGreen, type CalloutGreenProps } from "./CalloutGreen";
export { CalloutRed, type CalloutRedProps } from "./CalloutRed";
export { PreferenceCard, type PreferenceCardProps } from "./PreferenceCard";
export { PowerIndicator, type PowerIndicatorProps } from "./PowerIndicator";
export { SignatureBlock, type SignatureBlockProps } from "./SignatureBlock";
export { NotaryBlock } from "./NotaryBlock";
export { CoverTitle, type CoverTitleProps } from "./CoverTitle";
export { CoverSubtitle, type CoverSubtitleProps } from "./CoverSubtitle";
export { BoldStatutory, type BoldStatutoryProps } from "./BoldStatutory";
export { BrandedHeader, type BrandedHeaderProps } from "./BrandedHeader";
export { BrandedFooter, type BrandedFooterProps } from "./BrandedFooter";
