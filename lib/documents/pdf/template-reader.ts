import type { DocumentType } from "./document-config";

const TEMPLATE_IMPORTS: Record<DocumentType, () => Promise<{ default: string }>> = {
  will: () => import("@/lib/documents/templates/will-michigan-v1.1.0"),
  dpoa: () => import("@/lib/documents/templates/dpoa-michigan-v1.1.0"),
  pad: () => import("@/lib/documents/templates/pad-michigan-v1.1.0"),
  hipaa: () => import("@/lib/documents/templates/hipaa-authorization-v1.1.0"),
  funeral_rep: () => import("@/lib/documents/templates/funeral-rep-michigan-v1.0.0"),
  guardian_nomination: () => import("@/lib/documents/templates/guardian-nomination-michigan-v1.0.0"),
  trust: () => import("@/lib/documents/templates/trust-michigan-v1.1.0"),
  pour_over_will: () => import("@/lib/documents/templates/pour-over-will-michigan-v1.1.0"),
  certification_of_trust: () => import("@/lib/documents/templates/certification-of-trust-michigan-v1.0.0"),
  // Both grantors' assignments render from one template; what differs is the
  // assignor the intake supplies, not the text.
  assignment_personal_property_g1: () => import("@/lib/documents/templates/assignment-personal-property-michigan-v1.0.0"),
  assignment_personal_property_g2: () => import("@/lib/documents/templates/assignment-personal-property-michigan-v1.0.0"),
  trust_funding_instructions: () => import("@/lib/documents/templates/trust-funding-instructions-v1.0.0"),
};

export async function readTemplateFile(docType: DocumentType): Promise<string> {
  const loader = TEMPLATE_IMPORTS[docType];
  if (!loader) throw new Error(`No template for document type: ${docType}`);
  const mod = await loader();
  return mod.default;
}
