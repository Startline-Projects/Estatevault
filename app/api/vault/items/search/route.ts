import { NextRequest } from "next/server";
import { requireClientUser, bytesToBytea } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as vaultItemRepo from "@/lib/repos/server/vaultItemRepo";
import { vaultItemSearchSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

// Option A: client sends the plaintext query label. Server derives the index
// sub-key, computes the blind index, and matches it server-side.

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = vaultItemSearchSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);

  const dek = await getOrCreateUserDek(admin, client);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let blindHex: string;
  try {
    blindHex = bytesToBytea(blindIndex(indexKey, normalize(parsed.data.label)));
  } finally {
    zero(indexKey);
    zero(dek);
  }

  const { data: items } = await vaultItemRepo.findByLabelBlind(
    admin, client.id, blindHex, parsed.data.category,
  );
  return ok({ items: items ?? [] });
});
