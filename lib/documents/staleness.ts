/*
 * Detecting a Pour-Over Will that no longer matches its companion Trust.
 *
 * Since Prompt 6, Section 3.3 of the Pour-Over Will lists the client's primary
 * trust beneficiaries by name and share. That makes the two documents coupled:
 * if the beneficiaries or their shares are ever edited after the Pour-Over Will
 * was generated, the stored Pour-Over Will contradicts the Trust, and delivering
 * it would hand the client two documents that disagree about who inherits.
 *
 * This module supplies the detection primitive — a fingerprint of exactly the
 * intake that Section 3.3 depends on. Persisting that fingerprint against a
 * generated document needs a schema change and is deliberately NOT done here;
 * see PROMPT6_REGENERATION.md for the proposal.
 *
 * The fingerprint is deliberately NOT a hash of client names. Plaintext quiz
 * answers are purged after generation (quiz_sessions.answers_purged_at), so
 * storing anything that could reconstruct or confirm a name would reintroduce
 * the data that purge exists to remove. It is an HMAC keyed on a server secret,
 * which is comparable but not guessable.
 */

import { createHmac } from "crypto";

/** The intake shape Section 3.3 reads. */
export interface BeneficiaryLike {
  full_name: string;
  share_percent: string;
}

/** What a fingerprint covers, for diagnostics and for the proposal doc. */
export const FINGERPRINT_COVERS = [
  "primary_beneficiaries[].full_name",
  "primary_beneficiaries[].share_percent",
] as const;

/**
 * Canonical form of the beneficiary list: order-sensitive, whitespace-normalised,
 * and limited to the two fields Section 3.3 actually renders. Changing a
 * beneficiary's relationship or adding a contingent beneficiary does not make a
 * Pour-Over Will stale, so neither changes the fingerprint.
 */
export function canonicalBeneficiaries(beneficiaries: readonly BeneficiaryLike[]): string {
  return beneficiaries
    .map((b) => `${b.full_name.trim().replace(/\s+/g, " ")}|${b.share_percent.trim()}`)
    .join("\n");
}

function fingerprintKey(): string {
  // Falls back to a constant in dev so tests and local runs are deterministic;
  // in production HANDOFF_SECRET is set and the digest is not guessable.
  return process.env.HANDOFF_SECRET || "estatevault-dev-fingerprint-key";
}

/**
 * Stable fingerprint of the beneficiary data a Pour-Over Will was built from.
 * Equal fingerprints mean Section 3.3 would render identically.
 */
export function beneficiaryFingerprint(beneficiaries: readonly BeneficiaryLike[]): string {
  return createHmac("sha256", fingerprintKey())
    .update(canonicalBeneficiaries(beneficiaries))
    .digest("hex")
    .slice(0, 32);
}

export type StalenessVerdict =
  | { stale: false }
  | { stale: true; reason: string };

/**
 * Compares the fingerprint recorded when a Pour-Over Will was generated against
 * the intake as it stands now.
 *
 * A missing recorded fingerprint means the document predates fingerprinting; it
 * is reported as stale so a human looks at it, rather than assumed current.
 */
export function checkPourOverStaleness(
  recordedFingerprint: string | null | undefined,
  currentBeneficiaries: readonly BeneficiaryLike[],
): StalenessVerdict {
  const current = beneficiaryFingerprint(currentBeneficiaries);
  if (!recordedFingerprint) {
    return {
      stale: true,
      reason: "no beneficiary fingerprint was recorded when this Pour-Over Will was generated, so it cannot be shown to match the current trust beneficiaries",
    };
  }
  if (recordedFingerprint !== current) {
    return {
      stale: true,
      reason: "the trust's primary beneficiaries or their shares changed after this Pour-Over Will was generated, so Section 3.3 no longer matches the trust",
    };
  }
  return { stale: false };
}

/**
 * Guard for the generation path: the Pour-Over Will and the Trust must be built
 * from the same beneficiary list in the same run. They are today, because both
 * read one intake — this makes that an assertion rather than an assumption.
 */
export function assertPourOverMatchesTrust(
  pourOverBeneficiaries: readonly BeneficiaryLike[],
  trustBeneficiaries: readonly BeneficiaryLike[],
): void {
  const a = canonicalBeneficiaries(pourOverBeneficiaries);
  const b = canonicalBeneficiaries(trustBeneficiaries);
  if (a !== b) {
    throw new Error(
      "Pour-Over Will and Trust would be generated from different beneficiary lists. " +
        `Pour-Over: [${a.replace(/\n/g, "; ")}] Trust: [${b.replace(/\n/g, "; ")}]`,
    );
  }
}
