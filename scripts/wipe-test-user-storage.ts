/**
 * Per-user Storage wipe — companion to scripts/wipe-test-user.sql.
 *
 * Direct DELETE FROM storage.objects is blocked by storage.protect_delete(),
 * so SQL cannot remove blobs. This deletes only THIS user's objects via the
 * Storage API: vault item ciphertext, generated order documents, farewell
 * videos, and verification certificates.
 *
 * Run BEFORE the SQL — the SQL deletes the rows that hold the storage paths,
 * so blobs must go first or they become orphaned.
 *
 * ⚠️ DESTRUCTIVE. Run: npx tsx scripts/wipe-test-user-storage.ts <email>
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const email = (process.argv[2] ?? "waleed50602@gmail.com").toLowerCase();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE = 1000;

// Walk a prefix; return every file path beneath it (recurses into folders).
async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.metadata === null) {
        paths.push(...(await listAll(bucket, full)));
      } else {
        paths.push(full);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return paths;
}

async function removeAll(bucket: string, paths: string[]): Promise<number> {
  const unique = Array.from(new Set(paths)).filter(Boolean);
  let removed = 0;
  for (let i = 0; i < unique.length; i += PAGE) {
    const chunk = unique.slice(i, i + PAGE);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
    removed += chunk.length;
  }
  return removed;
}

async function main() {
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!user) {
    console.log(`No profile for ${email} — nothing to wipe.`);
    return;
  }
  const userId = user.id as string;

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", userId);
  const clientIds = (clients ?? []).map((c) => c.id as string);

  let orderIds: string[] = [];
  if (clientIds.length) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .in("client_id", clientIds);
    orderIds = (orders ?? []).map((o) => o.id as string);
  }

  // --- documents bucket: vault items + order docs + certificates -----------
  const docPaths: string[] = [];

  if (clientIds.length) {
    const { data: items } = await supabase
      .from("vault_items")
      .select("storage_path")
      .in("client_id", clientIds)
      .not("storage_path", "is", null);
    docPaths.push(...(items ?? []).map((r) => r.storage_path as string));

    const { data: certs } = await supabase
      .from("farewell_verification_requests")
      .select("certificate_storage_path")
      .in("client_id", clientIds)
      .not("certificate_storage_path", "is", null);
    docPaths.push(...(certs ?? []).map((r) => r.certificate_storage_path as string));

    // Vault blobs are nested vault/<clientId>/... — sweep the prefix too,
    // in case any object isn't referenced by a row.
    for (const cid of clientIds) {
      docPaths.push(...(await listAll("documents", `vault/${cid}`)));
    }
  }

  if (orderIds.length) {
    const { data: docs } = await supabase
      .from("documents")
      .select("storage_path")
      .in("order_id", orderIds)
      .not("storage_path", "is", null);
    docPaths.push(...(docs ?? []).map((r) => r.storage_path as string));
  }

  // --- farewell-videos bucket ---------------------------------------------
  const farewellPaths: string[] = [];
  if (clientIds.length) {
    const { data: fw } = await supabase
      .from("farewell_messages")
      .select("storage_path")
      .in("client_id", clientIds)
      .not("storage_path", "is", null);
    farewellPaths.push(...(fw ?? []).map((r) => r.storage_path as string));
  }

  const docRemoved = await removeAll("documents", docPaths);
  const fwRemoved = await removeAll("farewell-videos", farewellPaths);

  console.log(
    `Storage wiped for ${email}: documents=${docRemoved}, farewell-videos=${fwRemoved}`
  );
  console.log("Now run the SQL: scripts/wipe-test-user.sql");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
