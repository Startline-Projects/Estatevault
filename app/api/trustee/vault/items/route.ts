/**
 * GET /api/trustee/vault/items
 * Returns encrypted vault_items + documents + farewell_messages for the
 * client_id bound to the trustee session. Browser worker decrypts.
 *
 * Read-only. Every call audited. Refreshes session cookie.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  requireTrusteeSession,
  issueSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/security/trusteeSession";
import { byteaToBytes } from "@/lib/api/crypto";

export const runtime = "nodejs";

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function b64(b: Uint8Array): string { return Buffer.from(b).toString("base64"); }
function maybeB64(v: unknown): string | null {
  if (!v) return null;
  try { return b64(byteaToBytes(v)); } catch { return null; }
}

export async function GET(req: Request) {
  const sess = requireTrusteeSession();
  if (!sess) return NextResponse.json({ error: "no session" }, { status: 401 });

  const db = admin();

  // Re-verify request is still approved + not vetoed.
  const { data: r } = await db
    .from("farewell_verification_requests")
    .select("id, owner_vetoed_at, vault_unlock_approved")
    .eq("id", sess.requestId)
    .single();
  if (!r || r.owner_vetoed_at || !r.vault_unlock_approved) {
    const res = NextResponse.json({ error: "access revoked" }, { status: 403 });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Load trustee scope. NULL = legacy full access.
  const { data: trusteeRow } = await db
    .from("vault_trustees")
    .select("access_scope")
    .eq("id", sess.trusteeId)
    .maybeSingle();
  const scope = trusteeRow?.access_scope as { categories?: string[]; documents?: boolean; farewell?: boolean } | null;
  const allowAll = !scope;
  const allowCategories = allowAll ? null : (scope.categories ?? []);
  const allowDocuments = allowAll ? true : !!scope.documents;
  const allowFarewell = allowAll ? true : !!scope.farewell;

  let itemsQuery = db
    .from("vault_items")
    .select("id, category, ciphertext, nonce, enc_version, label_blind, storage_path, created_at, updated_at")
    .eq("client_id", sess.clientId);
  if (allowCategories !== null) {
    if (allowCategories.length === 0) {
      itemsQuery = itemsQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // force empty
    } else {
      itemsQuery = itemsQuery.in("category", allowCategories);
    }
  }
  const { data: items } = await itemsQuery
    .order("category", { ascending: true })
    .order("updated_at", { ascending: false });

  const { data: docs } = allowDocuments
    ? await db
        .from("documents")
        .select("id, filename, mime_type, size_bytes, storage_path, ciphertext, nonce, enc_version, created_at")
        .eq("client_id", sess.clientId)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  const { data: farewell } = allowFarewell
    ? await db
        .from("farewell_messages")
        .select("id, title, duration_seconds, storage_path, storage_header, enc_version, vault_farewell_status, created_at")
        .eq("client_id", sess.clientId)
    : { data: [] as never[] };

  // Audit list view.
  const ua = req.headers.get("user-agent") || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await db.from("trustee_access_audit").insert({
    trustee_id: sess.trusteeId,
    client_id: sess.clientId,
    request_id: sess.requestId,
    action: "list_items",
    ip, user_agent: ua,
    metadata: {
      vault_items: items?.length || 0,
      documents: docs?.length || 0,
      farewell: farewell?.length || 0,
    },
  });

  // Refresh session.
  const fresh = issueSession({
    requestId: sess.requestId,
    clientId: sess.clientId,
    trusteeId: sess.trusteeId,
    trusteeEmail: sess.trusteeEmail,
  });

  const res = NextResponse.json({
    ok: true,
    vaultItems: (items || []).map(i => ({
      id: i.id,
      category: i.category,
      ciphertext: maybeB64(i.ciphertext),
      nonce: maybeB64(i.nonce),
      encVersion: i.enc_version,
      storagePath: i.storage_path,
      updatedAt: i.updated_at,
    })),
    documents: (docs || []).map(d => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mime_type,
      sizeBytes: d.size_bytes,
      storagePath: d.storage_path,
      ciphertext: maybeB64(d.ciphertext),
      nonce: maybeB64(d.nonce),
      encVersion: d.enc_version,
      createdAt: d.created_at,
    })),
    farewell: (farewell || []).map(f => ({
      id: f.id, title: f.title, durationSeconds: f.duration_seconds,
      storagePath: f.storage_path, status: f.vault_farewell_status, createdAt: f.created_at,
      storageHeader: maybeB64(f.storage_header),
      encVersion: f.enc_version,
    })),
    sessionExpiresAt: new Date(fresh.expiresAt).toISOString(),
  });
  res.cookies.set(SESSION_COOKIE, fresh.value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return res;
}
