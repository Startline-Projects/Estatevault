import { isReactPdfRendererEnabled, isStrictTemplateMode } from "./pdf/feature-flag";
import { toTemplateDocType } from "./pdf/doc-type-map";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";
import { beneficiaryFingerprint } from "./staleness";
import { readTemplateFile } from "./pdf/template-reader";
import { renderTemplate } from "./render-template";
import { renderReactPdf } from "./pdf/render";
import { DOCUMENT_CONFIG } from "./pdf/document-config";

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

/**
 * Fills in whose property a given Assignment of Personal Property transfers.
 *
 * A joint trust produces one assignment per Grantor, each covering only that
 * Grantor's own property, so the assignor and the trustee line both change.
 */
function withAssignor(
  data: ReturnType<typeof mapIntakeToTemplateData>["data"] & object,
  isSecondGrantor: boolean,
) {
  const first = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ").trim();
  const assignor = isSecondGrantor ? data.grantor_2_full_name : first;
  const trusteeLine = data.is_joint_trust && data.grantor_2_full_name
    ? `${first} and ${data.grantor_2_full_name}, Trustees of the ${data.trust_name || ""} dated`
    : `${first}, Trustee of the ${data.trust_name || ""} dated`;
  return {
    ...data,
    assignor_full_name: assignor,
    assignor_city: data.city,
    assignor_state: "Michigan",
    assignment_trustee_line: trusteeLine,
  };
}

export interface TemplateRenderResult {
  pdfBuffer: Buffer;
  documentText: string;
  /**
   * The template version this document was actually rendered from, e.g.
   * "1.1.0-michigan". Recorded against the document so anything reasoning about
   * which template produced it gets the truth.
   */
  templateVersion: string;
  /**
   * Fingerprint of the intake fields this document's content depends on, or
   * null when the document has no intake-dependent coupling worth tracking.
   * Only the Pour-Over Will has one today: its Section 3.3 lists the trust's
   * primary beneficiaries, so it goes stale if those are edited.
   */
  sourceFingerprint: string | null;
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
  let templateData = adapted.data;

  // The two joint-trust assignments render from one template. Which Grantor is
  // assigning is decided here rather than duplicating the legal text.
  if (templateDocType === "assignment_personal_property_g1" || templateDocType === "assignment_personal_property_g2") {
    templateData = withAssignor(templateData, templateDocType === "assignment_personal_property_g2");
  }

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

  const { pdfBuffer } = await renderReactPdf(renderedText, templateDocType, branding, name, templateData.county);

  // Only the Pour-Over Will embeds another document's data (the trust's primary
  // beneficiaries, in Section 3.3), so only it can go stale against the intake.
  const sourceFingerprint =
    templateDocType === "pour_over_will"
      ? beneficiaryFingerprint(templateData.primary_beneficiaries)
      : null;

  return {
    pdfBuffer,
    documentText: renderedText,
    templateVersion: DOCUMENT_CONFIG[templateDocType].version,
    sourceFingerprint,
  };
}
