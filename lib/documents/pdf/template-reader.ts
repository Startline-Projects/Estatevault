import type { DocumentType } from "./document-config";

const TEMPLATE_IMPORTS: Record<DocumentType, () => Promise<{ default: string }>> = {
  will: () => import("@/lib/documents/templates/will-michigan-v1.1.0"),
  dpoa: () => import("@/lib/documents/templates/dpoa-michigan-v1.1.0"),
  pad: () => import("@/lib/documents/templates/pad-michigan-v1.1.0"),
  hipaa: () => import("@/lib/documents/templates/hipaa-authorization-v1.1.0"),
  funeral_rep: () => import("@/lib/documents/templates/funeral-rep-michigan-v1.0.0"),
  guardian_nomination: () => import("@/lib/documents/templates/guardian-nomination-michigan-v1.0.0"),
};

export async function readTemplateFile(docType: DocumentType): Promise<string> {
  const loader = TEMPLATE_IMPORTS[docType];
  if (!loader) throw new Error(`No template for document type: ${docType}`);
  const mod = await loader();
  return mod.default;
}
