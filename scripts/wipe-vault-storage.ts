/**
 * Option A — Phase 5: wipe pre-launch vault storage blobs.
 *
 * Companion to supabase/migrations/20260524_option_a_wipe_zk_data.sql.
 * Direct DELETE FROM storage.objects is blocked by storage.protect_delete();
 * this removes the ciphertext blobs via the Storage API instead.
 *
 * Paths are nested: vault/<clientId>/<uploadId>.bin — so we recurse.
 *
 * ⚠️ DESTRUCTIVE. PRE-LAUNCH ONLY. Do NOT run once real users exist.
 * Run: npx tsx scripts/wipe-vault-storage.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKETS = ["documents", "farewell-videos"];
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
      // Folders have no id/metadata in the Storage list response.
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

async function main() {
  for (const bucket of BUCKETS) {
    const files = await listAll(bucket, "");
    if (files.length === 0) {
      console.log(`${bucket}: empty`);
      continue;
    }
    // remove() caps at 1000 paths per call.
    let removed = 0;
    for (let i = 0; i < files.length; i += PAGE) {
      const chunk = files.slice(i, i + PAGE);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`remove ${bucket}: ${error.message}`);
      removed += chunk.length;
    }
    console.log(`${bucket}: removed ${removed} objects`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
