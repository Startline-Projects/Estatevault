import { isReactPdfRendererEnabled, isStrictTemplateMode } from "./pdf/feature-flag";
import { toTemplateDocType } from "./pdf/doc-type-map";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";
import { readTemplateFile } from "./pdf/template-reader";
import { renderTemplate } from "./render-template";
import { renderReactPdf } from "./pdf/render";

/**
 * Raised in strict mode when a document cannot be rendered correctly. The caller
 * should hold the order and alert an administrator rather than deliver a
 * document with blank clauses or fall through to the legacy generator.
 */
export class TemplateBlockedError extends Error {
  readonly docType: string;
  readonly reasons: string[];

  constructor(docType: string, reasons: string[]) {
    super(`Cannot generate ${docType}: missing ${reasons.join("; ")}`);
    this.name = "TemplateBlockedError";
    this.docType = docType;
    this.reasons = reasons;
  }
}

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
  if (!isReactPdfRendererEnabled()) return null;
  const strict = isStrictTemplateMode();

  const templateDocType = toTemplateDocType(docType);
  if (!templateDocType) {
    if (strict) throw new TemplateBlockedError(docType, ["a template for this document type"]);
    console.log(`[PDF_RENDERER] No react-pdf template for ${docType}, falling back to Claude path`);
    return null;
  }

  const adapted = mapIntakeToTemplateData(intake);
  if (adapted.error || !adapted.data) {
    if (strict) throw new TemplateBlockedError(docType, [`intake could not be read: ${adapted.error}`]);
    console.warn(`[PDF_RENDERER] Intake adapter validation failed for ${docType}, falling back to Claude path:`, adapted.error);
    return null;
  }
  const templateData = adapted.data;

  // The lenient schema cannot fail; these are the requirements that actually
  // determine whether the rendered document would be correct.
  const missing = validateForDocument(templateDocType, templateData);
  if (missing.length > 0) {
    if (strict) throw new TemplateBlockedError(docType, missing);
    console.warn(`[PDF_RENDERER] ${docType} missing required fields, falling back to Claude path:`, missing.join("; "));
    return null;
  }

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
