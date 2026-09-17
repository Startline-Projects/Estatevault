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

/**
 * The documents a generator should produce, or a monitor should expect, for an
 * order that ALREADY EXISTS: the rows it was created with, in delivery order.
 * Only an order with no rows at all falls back to what the product owes.
 *
 * Why the rows and not a fresh expectedDocumentTypes() call:
 *  - The rows ARE the order's contract. Whatever created them (webhook, free
 *    promo, test promo) already asked expectedDocumentTypes once, with the
 *    intake it had. Re-deriving the list later, possibly from a different
 *    snapshot, can only disagree — and a generated file whose type has no row
 *    is silently dropped (uploadDocument updates by order_id + document_type).
 *  - Orders created before the Trust Package grew from four documents to
 *    seven/eight have four rows. Measured against today's list they would look
 *    permanently unfinished: the reconcile cron would re-dispatch and alert on
 *    them every fifteen minutes, forever, for documents they were never sold.
 */
export function documentTypesForOrder(
  productType: string,
  intake: Record<string, unknown> | null | undefined,
  existingRowTypes: ReadonlyArray<string | null | undefined>,
): string[] {
  const rows = Array.from(new Set(existingRowTypes.filter((t): t is string => !!t)));
  if (rows.length === 0) return expectedDocumentTypes(productType, intake);

  const deliveryOrder =
    productType === "trust" ? trustPackageDocumentTypes(true) : expectedDocumentTypes(productType, intake);
  const rank = (t: string) => {
    const i = deliveryOrder.indexOf(t);
    return i === -1 ? deliveryOrder.length : i;
  };
  return rows.sort((a, b) => rank(a) - rank(b));
}

export interface OrderDocumentProgress {
  expected: string[];
  present: string[];
  missing: string[];
  complete: boolean;
}

/** Which of an order's documents have a finished file, and which do not. */
export function orderDocumentProgress(
  productType: string,
  intake: Record<string, unknown> | null | undefined,
  docs: ReadonlyArray<{ document_type: string | null; storage_path: string | null }>,
): OrderDocumentProgress {
  const expected = documentTypesForOrder(productType, intake, docs.map((d) => d.document_type));
  const ready = new Set(docs.filter((d) => d.storage_path).map((d) => d.document_type));
  const present = expected.filter((t) => ready.has(t));
  const missing = expected.filter((t) => !ready.has(t));
  return { expected, present, missing, complete: expected.length > 0 && missing.length === 0 };
}
