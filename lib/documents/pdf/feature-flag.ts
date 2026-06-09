export function useReactPdfRenderer(): boolean {
  return process.env.PDF_RENDERER === "react-pdf";
}
