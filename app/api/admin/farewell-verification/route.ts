import { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { adminFarewellVerificationSchema } from "@/lib/validation/schemas";
import { issueVetoToken } from "@/lib/security/vetoToken";
import { issueTrusteeToken } from "@/lib/security/trusteeToken";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import {
  sendOwnerVetoEmail,
  sendFarewellUnlockEmail,
  sendVerificationRejectedEmail,
  sendTrusteeUnlockEmail,
} from "@/lib/email";

const VAULT_UNLOCK_WINDOW_HOURS = process.env.TRUSTEE_BYPASS_VETO_WINDOW === "true" ? 0 : 72;

function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const { data: requests } = await fvRepo.findPending(auth.admin);

  const enriched = await Promise.all((requests || []).map(async (req) => {
    const profile = await fvRepo.getClientOwnerProfile(auth.admin, req.client_id);
    const { data: trustee } = await fvRepo.getTrusteeName(auth.admin, req.trustee_id ?? "");
    const { data: certUrl } = await fvRepo.getCertificateUrl(auth.admin, req.certificate_storage_path);

    return {
      ...req,
      client_name: profile?.full_name || "Unknown",
      trustee_name: trustee?.trustee_name || "Unknown",
      certificate_url: certUrl?.signedUrl || null,
    };
  }));

  return ok({ requests: enriched });
});

export const POST = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = adminFarewellVerificationSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { requestId, action, notes } = parsed.data;

  const { data: verReq } = await fvRepo.getByIdWithStatus(auth.admin, requestId);
  if (!verReq) return fail("Request not found", 404);
  if (verReq.status !== "pending") return fail("Request already processed", 400);

  if (action === "approve") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + VAULT_UNLOCK_WINDOW_HOURS * 3600 * 1000);
    const vetoToken = issueVetoToken(requestId, VAULT_UNLOCK_WINDOW_HOURS * 3600);
    const vetoTokenHash = hashToken(vetoToken);

    await fvRepo.approveRequest(auth.admin, requestId, {
      status: "approved",
      reviewed_at: now.toISOString(),
      reviewed_by: auth.user.id,
      notes: notes || null,
      vault_unlock_approved: true,
      unlock_window_started_at: now.toISOString(),
      unlock_window_expires_at: expiresAt.toISOString(),
      owner_veto_token_hash: vetoTokenHash,
    });

    try {
      const ownerProfile = await fvRepo.getClientOwnerProfile(auth.admin, verReq.client_id);
      if (ownerProfile?.email) {
        const baseUrl = getAppUrl();
        const vetoUrl = `${baseUrl}/farewell/owner-veto?token=${vetoToken}`;
        await sendOwnerVetoEmail({
          to: ownerProfile.email,
          ownerName: ownerProfile.full_name || "",
          vetoUrl,
          expiresAt: expiresAt.toUTCString(),
        });
      }
    } catch (e) { console.error("[veto-email] send failed:", e); }

    await fvRepo.unlockFarewellMessages(auth.admin, verReq.client_id);

    const clientName = await fvRepo.getClientNameByClientId(auth.admin, verReq.client_id);

    const { data: unlockedMessages } = await fvRepo.getUnlockedMessages(auth.admin, verReq.client_id);

    try {
      for (const msg of unlockedMessages || []) {
        await sendFarewellUnlockEmail({
          to: msg.recipient_email,
          clientName,
          messageTitle: msg.title,
          accessUrl: `https://www.estatevault.us/farewell/${verReq.client_id}`,
        });
      }
    } catch (emailErr) { console.error("Farewell unlock email failed:", emailErr); }

    await auditLogRepo.insertEntry(auth.admin, {
      actor_id: auth.user.id,
      action: "farewell.unlocked",
      resource_type: "farewell_verification_request",
      resource_id: requestId,
      metadata: { client_id: verReq.client_id, messages_unlocked: unlockedMessages?.length || 0 },
    });

    if (VAULT_UNLOCK_WINDOW_HOURS === 0) {
      try {
        const ACCESS_TTL_SECONDS = 7 * 24 * 3600;
        const trusteeToken = issueTrusteeToken(requestId, verReq.trustee_email, ACCESS_TTL_SECONDS);
        const accessExpiresAt = new Date(now.getTime() + ACCESS_TTL_SECONDS * 1000);

        await fvRepo.stampTrusteeNotified(auth.admin, requestId, {
          trustee_access_token_hash: hashToken(trusteeToken),
          access_expires_at: accessExpiresAt.toISOString(),
          trustee_email_notified_at: now.toISOString(),
        });

        const baseUrl = getAppUrl();
        await sendTrusteeUnlockEmail({
          to: verReq.trustee_email,
          unlockUrl: `${baseUrl}/trustee/unlock?token=${trusteeToken}`,
          expiresAt: accessExpiresAt,
        });
      } catch (e) {
        console.error("[bypass] inline trustee token issuance failed:", e);
      }
    }

    return ok({ success: true, action: "approved" });
  }

  if (action === "reject") {
    await fvRepo.rejectRequest(auth.admin, requestId, auth.user.id, notes || null);
    await fvRepo.resetFarewellMessages(auth.admin, verReq.client_id);

    try {
      await sendVerificationRejectedEmail({ to: verReq.trustee_email, notes });
    } catch (emailErr) { console.error("Rejection email failed:", emailErr); }

    await auditLogRepo.insertEntry(auth.admin, {
      actor_id: auth.user.id,
      action: "farewell.verification_rejected",
      resource_type: "farewell_verification_request",
      resource_id: requestId,
      metadata: { client_id: verReq.client_id },
    });

    return ok({ success: true, action: "rejected" });
  }

  return fail("Invalid action", 400);
});
