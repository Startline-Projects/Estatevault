/**
 * PDF_RENDERER selects the document pipeline:
 *   unset / anything else  → legacy Claude + pdf-lib path
 *   "react-pdf"            → template pipeline, silently falling back to legacy
 *                            when a document cannot be rendered (staged rollout)
 *   "react-pdf-strict"     → template pipeline only. A document that cannot be
 *                            rendered correctly raises TemplateBlockedError
 *                            instead of quietly producing a legacy document.
 */
export function isReactPdfRendererEnabled(): boolean {
  const v = process.env.PDF_RENDERER;
  return v === "react-pdf" || v === "react-pdf-strict";
}

/** True once the template pipeline is the production path and fallback is no longer acceptable. */
export function isStrictTemplateMode(): boolean {
  return process.env.PDF_RENDERER === "react-pdf-strict";
}
