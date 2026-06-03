import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { clientProfileUpdateSchema, clientAdvisorUpdateSchema } from "@/lib/validation/schemas";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

// B2: the signed-in client's settings — profile contact + notification prefs +
// advisor-sharing fields (was direct client-side supabase reads/writes).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const [{ data: profile }, { data: advisor }] = await Promise.all([
    profileRepo.getSettingsById(auth.admin, auth.user.id),
    clientRepo.getAdvisorByProfile(auth.admin, auth.user.id),
  ]);

  return ok({ profile: profile ?? null, advisor: advisor ?? null });
});

// B2: self-update of profile contact prefs OR advisor sharing, by `kind`.
export const PATCH = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as { kind?: string } | null;
  if (!body) return fail("invalid payload", 400);

  if (body.kind === "profile") {
    const parsed = clientProfileUpdateSchema.safeParse(body);
    if (!parsed.success) return fail("invalid payload", 400);
    await profileRepo.updateSettings(auth.admin, auth.user.id, parsed.data);
    return ok({ success: true });
  }

  if (body.kind === "advisor") {
    const parsed = clientAdvisorUpdateSchema.safeParse(body);
    if (!parsed.success) return fail("invalid payload", 400);
    await clientRepo.updateAdvisorByProfile(auth.admin, auth.user.id, parsed.data);
    return ok({ success: true });
  }

  return fail("unknown update kind", 400);
});
