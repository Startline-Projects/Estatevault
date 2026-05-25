import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { apiRateLimit } from "@/lib/rate-limit";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as vaultItemRepo from "@/lib/repos/server/vaultItemRepo";
import * as trusteeRepo from "@/lib/repos/server/trusteeRepo";
import * as farewellRepo from "@/lib/repos/server/farewellRepo";

export const runtime = "nodejs";

const Schema = z.object({
  table: z.enum(["vault_items", "vault_trustees", "farewell_messages"]),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withRoute(async (req: NextRequest) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const rl = await apiRateLimit.limit(`backfill-fetch:${user.id}`);
  if (!rl.success) return fail("rate limited", 429);

  const url = new URL(req.url);
  const parsed = Schema.safeParse({
    table: url.searchParams.get("table"),
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return fail("invalid query", 400);

  const admin = createAdminClient();
  const { data: client } = await clientRepo.getIdByProfile(admin, user.id);
  if (!client) return ok({ rows: [] });

  let rows: unknown[] = [];
  switch (parsed.data.table) {
    case "vault_items": {
      const { data } = await vaultItemRepo.fetchUnencrypted(admin, client.id, parsed.data.limit);
      rows = data ?? [];
      break;
    }
    case "vault_trustees": {
      const { data } = await trusteeRepo.fetchUnencrypted(admin, client.id, parsed.data.limit);
      rows = data ?? [];
      break;
    }
    case "farewell_messages": {
      const { data } = await farewellRepo.fetchUnencrypted(admin, client.id, parsed.data.limit);
      rows = data ?? [];
      break;
    }
  }

  return ok({ rows });
});
