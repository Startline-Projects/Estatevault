// Server-side data access for `farewell_verification_requests` — the only
// place that queries this table from the API layer.

import { createAdminClient } from "@/lib/api/auth";

type Admin = ReturnType<typeof createAdminClient>;

// Requests whose 72h veto window has expired and trustee hasn't been emailed yet.
export function findExpiredUnnotified(admin: Admin, now: string) {
  return admin
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_email, trustee_id, unlock_window_expires_at")
    .eq("vault_unlock_approved", true)
    .is("owner_vetoed_at", null)
    .is("trustee_email_notified_at", null)
    .lte("unlock_window_expires_at", now)
    .limit(50);
}

// Stamp a request after the trustee unlock email was sent.
export function stampTrusteeNotified(
  admin: Admin,
  requestId: string,
  patch: {
    trustee_access_token_hash: string;
    access_expires_at: string;
    trustee_email_notified_at: string;
  },
) {
  return admin
    .from("farewell_verification_requests")
    .update(patch)
    .eq("id", requestId);
}

// Active veto windows (approved, not vetoed, not yet expired).
export function findActiveVetoWindows(admin: Admin, now: string) {
  return admin
    .from("farewell_verification_requests")
    .select("id, client_id, unlock_window_expires_at")
    .eq("vault_unlock_approved", true)
    .is("owner_vetoed_at", null)
    .gt("unlock_window_expires_at", now)
    .order("unlock_window_expires_at", { ascending: true })
    .limit(50);
}

// Update the owner-veto token hash (rotated each reminder send).
export function updateVetoTokenHash(admin: Admin, requestId: string, hash: string) {
  return admin
    .from("farewell_verification_requests")
    .update({ owner_veto_token_hash: hash })
    .eq("id", requestId);
}

// Record a trustee access event in the dedicated audit table.
export function insertTrusteeAudit(
  admin: Admin,
  row: {
    trustee_id: string;
    client_id: string;
    request_id: string;
    action: string;
    metadata?: Record<string, unknown>;
    resource_type?: string;
    resource_id?: string;
    ip?: string | null;
    user_agent?: string | null;
  },
) {
  return admin.from("trustee_access_audit").insert(row);
}

export function findPending(admin: Admin) {
  return admin
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_id, trustee_email, certificate_storage_path, status, submitted_at, reviewed_at, notes")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
}

export function getByIdWithStatus(admin: Admin, id: string) {
  return admin
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_email, status")
    .eq("id", id)
    .single();
}

export function approveRequest(
  admin: Admin,
  id: string,
  patch: Record<string, unknown>,
) {
  return admin.from("farewell_verification_requests").update(patch).eq("id", id);
}

export function rejectRequest(
  admin: Admin,
  id: string,
  userId: string,
  notes: string | null,
) {
  return admin.from("farewell_verification_requests").update({
    status: "rejected",
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId,
    notes,
  }).eq("id", id);
}

export function unlockFarewellMessages(admin: Admin, clientId: string) {
  return admin.from("farewell_messages").update({
    vault_farewell_status: "unlocked",
    unlocked_at: new Date().toISOString(),
  }).eq("client_id", clientId)
    .in("vault_farewell_status", ["locked", "pending_verification"]);
}

export function resetFarewellMessages(admin: Admin, clientId: string) {
  return admin.from("farewell_messages").update({
    vault_farewell_status: "locked",
  }).eq("client_id", clientId)
    .eq("vault_farewell_status", "pending_verification");
}

export function getUnlockedMessages(admin: Admin, clientId: string) {
  return admin
    .from("farewell_messages")
    .select("id, title, recipient_email")
    .eq("client_id", clientId)
    .eq("vault_farewell_status", "unlocked");
}

export async function getClientOwnerProfile(admin: Admin, clientId: string) {
  const { data: client } = await admin
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .single();
  if (!client?.profile_id) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", client.profile_id)
    .single();
  return profile;
}

export async function getClientNameByClientId(admin: Admin, clientId: string) {
  const profile = await getClientOwnerProfile(admin, clientId);
  return profile?.full_name || "your loved one";
}

export function getTrusteeName(admin: Admin, trusteeId: string) {
  return admin
    .from("vault_trustees")
    .select("trustee_name")
    .eq("id", trusteeId)
    .single();
}

export function getCertificateUrl(admin: Admin, path: string) {
  return admin.storage.from("death-certificates").createSignedUrl(path, 3600);
}

export function verifyAccessStillValid(admin: Admin, requestId: string) {
  return admin
    .from("farewell_verification_requests")
    .select("owner_vetoed_at, vault_unlock_approved")
    .eq("id", requestId)
    .single();
}

export function getByIdForOtp(admin: Admin, requestId: string) {
  return admin
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_id, trustee_email, vault_unlock_approved, owner_vetoed_at, trustee_access_token_hash, access_expires_at, otp_email_hash, otp_email_expires_at, otp_email_attempts")
    .eq("id", requestId)
    .single();
}

export function storeOtp(admin: Admin, requestId: string, otpHash: string, expiresAt: string) {
  return admin.from("farewell_verification_requests").update({
    otp_email_hash: otpHash,
    otp_email_expires_at: expiresAt,
    otp_email_attempts: 0,
  }).eq("id", requestId);
}

export function burnOtp(admin: Admin, requestId: string) {
  return admin.from("farewell_verification_requests").update({
    otp_email_hash: null,
    otp_email_expires_at: null,
    otp_email_attempts: 0,
  }).eq("id", requestId);
}

export function incrementOtpAttempts(admin: Admin, requestId: string, current: number) {
  return admin.from("farewell_verification_requests")
    .update({ otp_email_attempts: current + 1 })
    .eq("id", requestId);
}
