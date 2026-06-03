import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";

// B2: the signed-in user's id + their latest quiz answers, used to pre-fill the
// will/trust intake (was a direct client-side read of `clients` + `quiz_sessions`).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await clientRepo.getFundingByProfile(auth.admin, auth.user.id);
  if (!client) return ok({ userId: auth.user.id, answers: null });

  const { data: quiz } = await quizSessionRepo.getLatestAnswersByClient(auth.admin, client.id);
  return ok({ userId: auth.user.id, answers: quiz?.answers ?? null });
});
