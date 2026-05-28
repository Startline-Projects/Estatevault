import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { encryptHandoff } from "@/lib/handoff";
import { clientUrl, partnerUrl, adminUrl, salesUrl } from "@/lib/hosts";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const { access_token, refresh_token, target, redirect_path } = await req.json();

  if (!access_token || !refresh_token || !target || !redirect_path) return fail("Missing fields", 400);
  if (!["client", "partner", "admin", "sales"].includes(target)) return fail("Invalid target", 400);
  if (typeof redirect_path !== "string" || !redirect_path.startsWith("/")) return fail("Invalid redirect_path", 400);

  const token = encryptHandoff({ access_token, refresh_token, redirect_path });
  const base =
    target === "partner" ? partnerUrl("/auth/handoff") :
    target === "admin" ? adminUrl("/auth/handoff") :
    target === "sales" ? salesUrl("/auth/handoff") :
    clientUrl("/auth/handoff");
  const url = `${base}?t=${encodeURIComponent(token)}`;
  return ok({ url });
});
