/**
 * GET /api/trustee/vault/items
 * Returns the owner's vault content for the client_id bound to the trustee
 * session, scoped by access_scope.
 *
 * Option A (server-managed): vault_items are decrypted server-side with the
 * owner's DEK and returned as plaintext metadata. File/video bytes stay in
 * Storage (downloaded via signed URL + /api/trustee/vault/file-key). Generated
 * documents (documents table) are already plaintext PDFs.
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
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { decryptBytes } from "@/lib/crypto/aead";

export const runtime = "nodejs";

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

interface TrusteeVaultItem {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  storagePath: string | null;
  updatedAt: string;
}

interface TrusteeFarewell {
  id: string;
  title: string;
  durationSeconds: number | null;
  storagePath: string | null;
  status: string;
  createdAt: string;
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

  // Load the owner's client row to obtain the DEK for server-side decryption.
  const { data: ownerClient } = await db
    .from("clients")
    .select("id, wrapped_dek")
    .eq("id", sess.clientId)
    .single();
  if (!ownerClient) {
    return NextResponse.json({ error: "owner not found" }, { status: 404 });
  }

  let itemsQuery = db
    .from("vault_items")
    .select("id, category, ciphertext, storage_path, created_at, updated_at")
    .eq("client_id", sess.clientId);
  if (allowCategories !== null) {
    if (allowCategories.length === 0) {
      itemsQuery = itemsQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // force empty
    } else {
      itemsQuery = itemsQuery.in("category", allowCategories);
    }
  }
  const { data: rawItems } = await itemsQuery
    .order("category", { ascending: true })
    .order("updated_at", { ascending: false });

  // Generated documents (wills/trusts) are plaintext PDFs in the documents bucket.
  const { data: docs } = allowDocuments
    ? await db
        .from("documents")
        .select("id, document_type, status, storage_path, created_at")
        .eq("client_id", sess.clientId)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  // Farewell title/recipient are encrypted (ciphertext); decrypt below.
  const { data: rawFarewell } = allowFarewell
    ? await db
        .from("farewell_messages")
        .select("id, ciphertext, duration_seconds, storage_path, vault_farewell_status, created_at")
        .eq("client_id", sess.clientId)
        .not("vault_farewell_status", "in", '("deleted","replaced","expired")')
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  // Decrypt vault_items + farewell titles server-side with the owner's DB sub-key.
  const vaultItems: TrusteeVaultItem[] = [];
  const farewell: TrusteeFarewell[] = [];
  if ((rawItems && rawItems.length > 0) || (rawFarewell && rawFarewell.length > 0)) {
    const dek = await getOrCreateUserDek(db, ownerClient);
    const dbKey = await deriveSubKey(dek, INFO.DB);
    try {
      for (const it of rawItems ?? []) {
        let label = "";
        let data: Record<string, unknown> = {};
        const ct = byteaToBytes(it.ciphertext);
        if (ct.length > 0) {
          try {
            const pt = await decryptBytes(dbKey, ct);
            const parsed = JSON.parse(new TextDecoder().decode(pt)) as { label?: string; data?: Record<string, unknown> };
            label = typeof parsed.label === "string" ? parsed.label : "";
            data = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
          } catch {
            label = "[decryption failed]";
          }
        }
        vaultItems.push({
          id: it.id,
          category: it.category,
          label,
          data,
          storagePath: it.storage_path,
          updatedAt: it.updated_at ?? it.created_at,
        });
      }

      for (const f of rawFarewell ?? []) {
        let title = "";
        const ct = byteaToBytes(f.ciphertext);
        if (ct.length > 0) {
          try {
            const pt = await decryptBytes(dbKey, ct);
            const meta = JSON.parse(new TextDecoder().decode(pt)) as { title?: string };
            title = typeof meta.title === "string" ? meta.title : "";
          } catch {
            title = "[decryption failed]";
          }
        }
        farewell.push({
          id: f.id,
          title,
          durationSeconds: f.duration_seconds,
          storagePath: f.storage_path,
          status: f.vault_farewell_status,
          createdAt: f.created_at,
        });
      }
    } finally {
      zero(dbKey);
      zero(dek);
    }
  }

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
      vault_items: vaultItems.length,
      documents: docs?.length || 0,
      farewell: farewell.length,
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
    vaultItems,
    documents: (docs || []).map(d => ({
      id: d.id,
      documentType: d.document_type,
      status: d.status,
      storagePath: d.storage_path,
      createdAt: d.created_at,
    })),
    farewell,
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
