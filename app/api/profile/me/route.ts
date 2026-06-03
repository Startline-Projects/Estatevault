import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { profileSelfUpdateSchema } from "@/lib/validation/schemas";
import * as profileRepo from "@/lib/repos/server/profileRepo";

// B2: the signed-in user's own profile basics, behind the API boundary.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: profile } = await profileRepo.getMeById(auth.admin, auth.user.id);
  return ok({ profile: profile ?? null });
});

// B2: self-update of the signed-in user's display name.
export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const parsed = profileSelfUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  await profileRepo.updateName(auth.admin, auth.user.id, parsed.data.full_name);
  return ok({ success: true });
});
