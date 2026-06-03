import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { fundingChecklistSchema } from "@/lib/validation/schemas";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";

// B2: the signed-in client's trust funding checklist + asset types from their
// latest trust quiz (was a direct client-side supabase read/write).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await clientRepo.getFundingByProfile(auth.admin, auth.user.id);
  if (!client) return ok({ checklist: {}, assetTypes: [] });

  const checklist =
    client.funding_checklist && typeof client.funding_checklist === "object"
      ? (client.funding_checklist as Record<string, boolean>)
      : {};

  const { data: quiz } = await quizSessionRepo.getLatestTrustAnswersByClient(auth.admin, client.id);
  const answers = (quiz?.answers as Record<string, unknown> | undefined) ?? {};
  const assetTypes = (answers.assetTypes as string[] | undefined) ?? [];

  return ok({ checklist, assetTypes });
});

// B2: persist the client's funding checklist, scoped to their own row.
export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const parsed = fundingChecklistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  await clientRepo.updateFundingByProfile(auth.admin, auth.user.id, parsed.data.checklist);
  return ok({ success: true });
});
