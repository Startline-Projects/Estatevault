import { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { sendApprovalEmail } from "@/lib/email";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import { attorneyNotifyClientSchema } from "@/lib/validation/schemas";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "admin"]);
  if ("error" in auth) return auth.error;

  const rawBody = await req.json();
  const parsedNotify = attorneyNotifyClientSchema.safeParse(rawBody);
  if (!parsedNotify.success) return fail("invalid payload", 400);
  const { reviewId } = parsedNotify.data;

  const { data: review } = await attorneyReviewRepo.getReviewWithOrder(auth.admin, reviewId);
  if (!review) return fail("Review not found", 404);

  const order = (review.orders as unknown) as Record<string, unknown> | null;
  const productType = (order?.product_type as "will" | "trust") || "will";
  const client = (order?.clients as unknown) as Record<string, unknown> | null;
  const clientProfile = (client?.profiles as unknown) as { email: string } | null;
  const email = clientProfile?.email;

  if (!email) return fail("Client email not found", 404);

  const dashboardUrl = `${getAppUrl()}/dashboard/documents`;
  const partnerId = (order?.partner_id as string | null) || null;
  await sendApprovalEmail({ to: email, productType, dashboardUrl, partnerId });

  return ok({ success: true });
});
