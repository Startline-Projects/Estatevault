import type { DocumentType } from "./document-config";

const ROUTE_TO_TEMPLATE: Record<string, DocumentType | null> = {
  will: "will",
  poa: "dpoa",
  healthcare_directive: "pad",
  trust: "trust",
  pour_over_will: "pour_over_will",
};

export function toTemplateDocType(routeDocType: string): DocumentType | null {
  return ROUTE_TO_TEMPLATE[routeDocType] ?? null;
}
