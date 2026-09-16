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

/**
 * Whether an order's raw intake describes a joint trust.
 *
 * Mirrors the rule in mapIntakeToTemplateData: a second grantor's NAME makes
 * the trust joint; an explicit isJointTrust answer decides it when no name is
 * present; "No" clears any stale name. The webhook needs this before the
 * adapter runs, so the rule lives here and a test pins the two together — if
 * they ever disagree, an order creates the wrong number of document rows.
 */
export function isJointTrustIntake(
  intake: Record<string, unknown> | null | undefined,
): boolean {
  if (!intake) return false;
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  const jointAnswer = str(intake.isJointTrust ?? intake.is_joint_trust ?? "").trim().toLowerCase();
  const secondGrantor =
    jointAnswer === "no"
      ? ""
      : str(
          intake.secondGrantorName ?? intake.grantor2Name ?? intake.grantor_2_full_name,
        ).trim();

  if (secondGrantor) return true;
  if (intake.isJointTrust !== undefined) return jointAnswer === "yes" || jointAnswer === "true";
  if (intake.is_joint_trust !== undefined) {
    return intake.is_joint_trust === true || jointAnswer === "yes" || jointAnswer === "true";
  }
  return false;
}

/**
 * Every document row an order owes the client, in delivery order.
 *
 * The webhook used to hardcode four types for a trust, so the Certification of
 * Trust, both Assignments and the Funding Instructions were never created —
 * their templates rendered fine but no order ever asked for them.
 */
export function expectedDocumentTypes(
  productType: string,
  intake: Record<string, unknown> | null | undefined,
): string[] {
  if (productType === "trust") {
    return trustPackageDocumentTypes(isJointTrustIntake(intake));
  }
  return ["will", "poa", "healthcare_directive"];
}
