/*
 * What a Trust Package contains, and when it is complete.
 *
 * Delivery order is fixed by the attorney's notes: Revocable Living Trust,
 * Trust Instructions, Certification of Trust, Assignment of Personal Property,
 * Pour-Over Will, Pour-Over Will Instructions, Funding Instructions.
 *
 * Each document carries its own instruction sheet as its final page, so
 * "Trust Instructions" and "Pour-Over Will Instructions" are not separate
 * documents — they are pages of the documents they belong to. What the list
 * below enumerates is the files an order must produce.
 */

/** Document types a Trust Package order generates, in delivery order. */
export function trustPackageDocumentTypes(isJointTrust: boolean): string[] {
  return [
    "trust",
    "certification_of_trust",
    "assignment_personal_property_g1",
    // A joint trust generates one assignment per Grantor, each covering that
    // Grantor's own property. The order is not complete until both exist.
    ...(isJointTrust ? ["assignment_personal_property_g2"] : []),
    "pour_over_will",
    "trust_funding_instructions",
    // The Trust Package also includes the financial and medical documents.
    "poa",
    "healthcare_directive",
  ];
}

export interface PackageCompleteness {
  complete: boolean;
  missing: string[];
}

/**
 * Whether every document a Trust Package owes the client actually exists.
 *
 * A joint-trust order that produced only one assignment is incomplete, which is
 * the case this function exists to catch.
 */
export function checkTrustPackageComplete(
  isJointTrust: boolean,
  presentDocumentTypes: readonly string[],
): PackageCompleteness {
  const present = new Set(presentDocumentTypes);
  const missing = trustPackageDocumentTypes(isJointTrust).filter((t) => !present.has(t));
  return { complete: missing.length === 0, missing };
}
