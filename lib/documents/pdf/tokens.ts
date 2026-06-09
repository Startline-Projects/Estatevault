/**
 * Centralized design tokens for the PDF rendering pipeline.
 *
 * All visual styling values — colors, fonts, spacing, font sizes, letter
 * spacing, and border widths — live here so the React components in
 * `./components/` can reference them by semantic name rather than hard-coding
 * raw values. This keeps the design language consistent across documents and
 * makes future re-themes (e.g., partner white-label) a single-file change.
 *
 * Font note: `@react-pdf/renderer` ships with Helvetica, Times-Roman,
 * Times-Bold, Times-Italic, and Courier as built-in PostScript fonts. We use
 * the Times family for body serif and Helvetica for sans-serif. Calibri and
 * Cambria from Mike's .docx originals are not available without registering
 * custom fonts; deferring that to a later step.
 */
export const TOKENS = {
  colors: {
    navy: "#1B2C5B",
    navyDark: "#0F1B3D",
    gold: "#C9A961",
    grayText: "#4A5568",
    grayBorder: "#CBD5E0",
    bgLight: "#F7FAFC",
    amberBg: "#FEF3C7",
    greenBg: "#ECFDF5",
    greenDark: "#064E3B",
    greenRule: "#059669",
    redBg: "#FEE2E2",
    redDark: "#991B1B",
    redRule: "#DC2626",
    tealBg: "#ECFEFF",
    tealDark: "#155E63",
    tealRule: "#0E7490",
    white: "#FFFFFF",
    black: "#000000",
  },
  fonts: {
    sans: "Helvetica",
    serif: "Times-Roman",
    serifBold: "Times-Bold",
    serifItalic: "Times-Italic",
  },
  spacing: {
    pageMargin: 72,
    paragraphAfter: 8,
    sectionBefore: 14,
    articleBefore: 18,
    coverTopPadding: 60,
  },
  fontSize: {
    body: 11,
    bodySmall: 10,
    sectionHeader: 11,
    articleHeader: 11,
    coverTitle: 28,
    coverSubtitle: 12,
    footer: 8,
    notaryLabel: 11,
  },
  letterSpacing: {
    articleHeader: 3,
    sectionLabel: 2,
    coverTitle: 4,
  },
  borderWidth: {
    leftBar: 4,
    ruleThick: 2,
    ruleThin: 1,
  },
} as const;

/** Type alias capturing the shape of {@link TOKENS}, useful for typed helpers. */
export type DesignTokens = typeof TOKENS;
