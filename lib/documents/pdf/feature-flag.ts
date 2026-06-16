export function isReactPdfRendererEnabled(): boolean {
  return process.env.PDF_RENDERER === "react-pdf";
}
