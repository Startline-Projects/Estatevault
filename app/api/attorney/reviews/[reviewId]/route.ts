import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { attorneyReviewStatusSchema } from "@/lib/validation/schemas";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";

// B2: move a review's status. Scoped to the owning attorney (the client-side
// version updated attorney_reviews directly).
export const PATCH = withRoute(async (
  req: NextRequest,
  { params }: { params: { reviewId: string } },
) => {
  const auth = await requireAuth(["review_attorney", "attorney"], req);
  if ("error" in auth) return auth.error;

  const parsed = attorneyReviewStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const { data: updated } = await attorneyReviewRepo.updateStatusForAttorney(
    auth.admin,
    params.reviewId,
    auth.user.id,
    parsed.data.status,
  );
  if (!updated) return fail("not found", 404);
  return ok({ success: true });
});
