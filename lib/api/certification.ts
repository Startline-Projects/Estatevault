/**
 * Partner certification gate.
 *
 * Certification used to be a facade: an exam page with no questions, a button
 * that called POST /api/partner/certify, and a route that set the flag after
 * reading nothing. The flag then gated nothing on the server — the "Complete
 * Certification" lock was a disabled button in the browser, and the routes
 * behind it accepted uncertified partners.
 *
 * Until there is a real exam, the flag is set by Admin or a sales rep, and the
 * routes that put a partner in front of a client enforce it.
 */

import { NextResponse } from "next/server";
import { fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import type { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

export type CertificationGate =
  | { ok: true; partnerId: string }
  | { ok: false; error: NextResponse };

/**
 * Resolve the signed-in partner and refuse when they are not certified.
 * Returns the partner id on success so the caller does not look it up twice.
 */
export async function requireCertifiedPartner(
  admin: Admin,
  profileId: string,
): Promise<CertificationGate> {
  const { data: partner } = await partnerRepo.getByProfileId(admin, profileId);
  if (!partner) return { ok: false, error: fail("partner not found", 404) };

  if (!partner.certification_completed) {
    return {
      ok: false,
      error: fail(
        "Your certification is not complete. Contact EstateVault to finish certification before working with clients.",
        403,
      ),
    };
  }
  return { ok: true, partnerId: partner.id };
}
