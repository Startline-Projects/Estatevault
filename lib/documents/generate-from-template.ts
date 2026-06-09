import { useReactPdfRenderer } from "./pdf/feature-flag";
import { toTemplateDocType } from "./pdf/doc-type-map";
import { mapIntakeToTemplateData } from "./intake-adapter";
import { readTemplateFile } from "./pdf/template-reader";
import { renderTemplate } from "./render-template";
import { renderReactPdf } from "./pdf/render";

export interface TemplateRenderResult {
  pdfBuffer: Buffer;
  documentText: string;
}

/**
 * Try generating a document via the template + React-PDF path.
 * Returns null if the feature flag is off, the doc type has no template,
 * or intake adapter validation fails (caller falls back to Claude path).
 */
export async function tryTemplateRender(
  docType: string,
  intake: Record<string, unknown>,
  partnerName?: string,
  partnerLogoUrl?: string | null,
  clientFullName?: string,
): Promise<TemplateRenderResult | null> {
  if (!useReactPdfRenderer()) return null;

  const templateDocType = toTemplateDocType(docType);
  if (!templateDocType) {
    console.log(`[PDF_RENDERER] No react-pdf template for ${docType}, falling back to Claude path`);
    return null;
  }

  const adapted = mapIntakeToTemplateData(intake);
  if (adapted.error || !adapted.data) {
    console.warn(`[PDF_RENDERER] Intake adapter validation failed for ${docType}, falling back to Claude path:`, adapted.error);
    return null;
  }
  const templateData = adapted.data;

  const txtTemplate = await readTemplateFile(templateDocType);
  const renderedText = renderTemplate(txtTemplate, templateData);

  const branding = {
    isWhiteLabel: !!partnerName,
    partnerName: partnerName || undefined,
    partnerLogoUrl: partnerLogoUrl || undefined,
  };

  const name = clientFullName || `${templateData.first_name} ${templateData.last_name}`.trim();

  const { pdfBuffer } = await renderReactPdf(renderedText, templateDocType, branding, name);

  return { pdfBuffer, documentText: renderedText };
}
