import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { DocumentRenderer } from "./DocumentRenderer";
import type { DocumentType, BrandingContext } from "./document-config";

export interface RenderResult {
  pdfBuffer: Buffer;
  renderedText: string;
}

export async function renderReactPdf(
  renderedText: string,
  documentType: DocumentType,
  branding: BrandingContext,
  clientFullName: string,
): Promise<RenderResult> {
  const element = React.createElement(DocumentRenderer, {
    renderedText,
    documentType,
    branding,
    clientFullName,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buf = await renderToBuffer(element);
  return {
    pdfBuffer: Buffer.from(buf),
    renderedText,
  };
}
