/**
 * Per-document-type metadata used by the PDF rendering pipeline.
 *
 * Each entry maps a logical {@link DocumentType} to the assets and labels the
 * renderer needs:
 *   - `title`         — the all-caps document name shown in the branded page header
 *   - `templateFile`  — filename inside `lib/documents/templates/` to load and resolve
 *   - `version`       — the human-readable version string surfaced in the page header
 *                       (e.g. "v1.1.0-michigan") and in any partner audit logs
 *   - `filenameLabel` — the human-friendly label used when constructing a download
 *                       filename (e.g. "Last Will and Testament — Jane Q. Public.pdf")
 *
 * Adding a new document type is a config change here plus a new template file
 * — no renderer code changes required as long as the document fits the existing
 * block vocabulary.
 */

/** All document types the pipeline can render. */
export type DocumentType =
  | "will"
  | "dpoa"
  | "pad"
  | "hipaa"
  | "funeral_rep"
  | "guardian_nomination"
  | "trust"
  | "pour_over_will"
  | "certification_of_trust"
  | "assignment_personal_property_g1"
  | "assignment_personal_property_g2"
  | "trust_funding_instructions";

/** Per-document metadata consumed by {@link DocumentRenderer}. */
export interface DocumentConfig {
  /** Displayed in the {@link BrandedHeader} (uppercase, letter-spaced). */
  title: string;
  /** Filename inside `lib/documents/templates/`. */
  templateFile: string;
  /** Template version string (passed to BrandedHeader and used by audit logs). */
  version: string;
  /** Human-friendly label for the PDF download filename. */
  filenameLabel: string;
}

/**
 * Branding context passed through the layout. Controls whether the document
 * displays EstateVault marks or partner co-branding, and which legal disclaimer
 * appears in the footer.
 */
export interface BrandingContext {
  isWhiteLabel: boolean;
  partnerName?: string;
  partnerLogoUrl?: string;
  productName?: string;
}

export const DOCUMENT_CONFIG: Record<DocumentType, DocumentConfig> = {
  will: {
    title: "LAST WILL AND TESTAMENT",
    templateFile: "will-michigan-v1.1.0.txt",
    version: "1.1.0-michigan",
    filenameLabel: "Last Will and Testament",
  },
  dpoa: {
    title: "DURABLE POWER OF ATTORNEY",
    templateFile: "dpoa-michigan-v1.1.0.txt",
    version: "1.1.0-michigan",
    filenameLabel: "Durable Power of Attorney",
  },
  pad: {
    title: "PATIENT ADVOCATE DESIGNATION",
    templateFile: "pad-michigan-v1.1.0.txt",
    version: "1.1.0-michigan",
    filenameLabel: "Patient Advocate Designation",
  },
  hipaa: {
    title: "HIPAA AUTHORIZATION",
    templateFile: "hipaa-authorization-v1.1.0.txt",
    version: "1.1.0",
    filenameLabel: "HIPAA Authorization",
  },
  funeral_rep: {
    title: "FUNERAL REPRESENTATIVE DESIGNATION",
    templateFile: "funeral-rep-michigan-v1.0.0.txt",
    version: "1.0.0-michigan",
    filenameLabel: "Funeral Representative Designation",
  },
  guardian_nomination: {
    title: "NOMINATION OF GUARDIAN",
    templateFile: "guardian-nomination-michigan-v1.0.0.txt",
    version: "1.0.0-michigan",
    filenameLabel: "Nomination of Guardian",
  },
  trust: {
    title: "REVOCABLE LIVING TRUST",
    templateFile: "trust-michigan-v1.1.0.txt",
    version: "1.1.0-michigan",
    filenameLabel: "Revocable Living Trust",
  },
  pour_over_will: {
    title: "POUR-OVER WILL",
    templateFile: "pour-over-will-michigan-v1.1.0.txt",
    version: "1.1.0-michigan",
    filenameLabel: "Pour-Over Will",
  },
  certification_of_trust: {
    title: "CERTIFICATION OF TRUST",
    templateFile: "certification-of-trust-michigan-v1.0.0.txt",
    version: "1.0.0-michigan",
    filenameLabel: "Certification of Trust",
  },
  // A joint trust generates one assignment per Grantor, each covering that
  // Grantor's own property. Distinct document types rather than a discriminator
  // column, so the existing (order_id, document_type) keying keeps working.
  assignment_personal_property_g1: {
    title: "ASSIGNMENT OF PERSONAL PROPERTY",
    templateFile: "assignment-personal-property-michigan-v1.0.0.txt",
    version: "1.0.0-michigan",
    filenameLabel: "Assignment of Personal Property",
  },
  assignment_personal_property_g2: {
    title: "ASSIGNMENT OF PERSONAL PROPERTY",
    templateFile: "assignment-personal-property-michigan-v1.0.0.txt",
    version: "1.0.0-michigan",
    filenameLabel: "Assignment of Personal Property (Second Grantor)",
  },
  trust_funding_instructions: {
    title: "TRUST FUNDING INSTRUCTIONS",
    templateFile: "trust-funding-instructions-v1.0.0.txt",
    version: "1.0.0",
    filenameLabel: "Trust Funding Instructions",
  },
};
