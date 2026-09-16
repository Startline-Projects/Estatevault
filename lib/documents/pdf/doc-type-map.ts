import type { DocumentType } from "./document-config";

const ROUTE_TO_TEMPLATE: Record<string, DocumentType | null> = {
  will: "will",
  poa: "dpoa",
  // "healthcare_directive" is the persisted document_type on the documents
  // table and in order document-type arrays; it must not change. It now
  // resolves to the Advance Healthcare Directive.
  healthcare_directive: "ahcd",
  advance_healthcare_directive: "ahcd",
  trust: "trust",
  pour_over_will: "pour_over_will",
  certification_of_trust: "certification_of_trust",
  assignment_personal_property_g1: "assignment_personal_property_g1",
  assignment_personal_property_g2: "assignment_personal_property_g2",
  trust_funding_instructions: "trust_funding_instructions",
};

export function toTemplateDocType(routeDocType: string): DocumentType | null {
  return ROUTE_TO_TEMPLATE[routeDocType] ?? null;
}
