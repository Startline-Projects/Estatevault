import type { DocumentType } from "./document-config";

const ROUTE_TO_TEMPLATE: Record<string, DocumentType | null> = {
  will: "will",
  poa: "dpoa",
  healthcare_directive: "pad",
  trust: null,
  pour_over_will: null,
};

export function toTemplateDocType(routeDocType: string): DocumentType | null {
  return ROUTE_TO_TEMPLATE[routeDocType] ?? null;
}
