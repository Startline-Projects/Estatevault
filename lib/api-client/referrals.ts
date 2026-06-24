import { publicPost, type ApiResult } from "./client";

export type HardStopReferralInput = {
  partnerId?: string;
  reason: string;
  name: string;
  email: string;
  phone?: string;
};

// Log an attorney referral when a client hits a hard stop during intake. Public
// (no auth) — called from the hard-stop contact form. partnerId is the partner
// UUID from the `?partner=` param; the contact fields are what the partner and
// attorney use to follow up.
export function recordHardStopReferral(
  input: HardStopReferralInput,
): Promise<ApiResult<{ recorded: boolean }>> {
  return publicPost("/api/referrals", input);
}
