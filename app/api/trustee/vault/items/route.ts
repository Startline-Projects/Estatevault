import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import {
  requireTrusteeSession,
  issueSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/security/trusteeSession";
import { resolveTrusteeScope } from "@/lib/security/trusteeScope";
import { byteaToBytes } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { decryptBytes } from "@/lib/crypto/aead";
import * as fvRepo from "@/lib/repos/server/farewellVerificationRepo";

export const runtime = "nodejs";

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

export const GET = withRoute(async (req: NextRequest) => {
  const sess = requireTrusteeSession();
  if (!sess) return fail("no session", 401);

  const admin = createAdminClient();

  const { data: r } = await fvRepo.verifyAccessStillValid(admin, sess.requestId);
  if (!r || r.owner_vetoed_at || !r.vault_unlock_approved) {
    const res = fail("access revoked", 403);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const { data: trusteeRow } = await admin
    .from("vault_trustees")
    .select("access_scope")
    .eq("id", sess.trusteeId)
    .maybeSingle();
  const { allowCategories, allowDocuments, allowFarewell } = resolveTrusteeScope(
    trusteeRow?.access_scope,
  );

  const { data: ownerClient } = await admin
    .from("clients")
    .select("id, wrapped_dek")
    .eq("id", sess.clientId)
    .single();
  if (!ownerClient) return fail("owner not found", 404);

  let itemsQuery = admin
    .from("vault_items")
    .select("id, category, ciphertext, storage_path, created_at, updated_at")
    .eq("client_id", sess.clientId);
  if (allowCategories !== null) {
    if (allowCategories.length === 0) {
      itemsQuery = itemsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      itemsQuery = itemsQuery.in("category", allowCategories);
    }
  }
  const { data: rawItems } = await itemsQuery
    .order("category", { ascending: true })
    .order("updated_at", { ascending: false });

  const { data: docs } = allowDocuments
    ? await admin
        .from("documents")
        .select("id, document_type, status, storage_path, created_at")
        .eq("client_id", sess.clientId)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  const { data: rawFarewell } = allowFarewell
    ? await admin
        .from("farewell_messages")
        .select("id, ciphertext, duration_seconds, storage_path, vault_farewell_status, created_at")
        .eq("client_id", sess.clientId)
        .not("vault_farewell_status", "in", '("deleted","replaced","expired")')
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  const vaultItems: TrusteeVaultItem[] = [];
  const farewell: TrusteeFarewell[] = [];
  if ((rawItems && rawItems.length > 0) || (rawFarewell && rawFarewell.length > 0)) {
    const dek = await getOrCreateUserDek(admin, ownerClient);
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
          updatedAt: it.updated_at ?? it.created_at ?? "",
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

  const ua = req.headers.get("user-agent") || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await fvRepo.insertTrusteeAudit(admin, {
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

  const fresh = issueSession({
    requestId: sess.requestId,
    clientId: sess.clientId,
    trusteeId: sess.trusteeId,
    trusteeEmail: sess.trusteeEmail,
  });

  const res = ok({
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
});
