export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const GET = withRoute(async (_req: NextRequest) => {
  const admin = createAdminClient();

  const { data: overdue } = await attorneyReviewRepo.findOverdue(admin);
  if (!overdue || overdue.length === 0) return ok({ message: "No overdue reviews" });

  for (const review of overdue) {
    await auditLogRepo.insertEntry(admin, {
      action: "attorney_review.sla_overdue",
      resource_type: "attorney_review",
      resource_id: review.id,
      metadata: { order_id: review.order_id, sla_deadline: review.sla_deadline },
    });
  }

  return ok({ overdue_count: overdue.length });
});
