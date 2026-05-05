import { NextResponse } from "next/server";
import { encryptHandoff } from "@/lib/handoff";
import { clientUrl, partnerUrl, adminUrl, salesUrl } from "@/lib/hosts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token, target, redirect_path } = await request.json();

    if (!access_token || !refresh_token || !target || !redirect_path) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!["client", "partner", "admin", "sales"].includes(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
    if (typeof redirect_path !== "string" || !redirect_path.startsWith("/")) {
      return NextResponse.json({ error: "Invalid redirect_path" }, { status: 400 });
    }

    const token = encryptHandoff({ access_token, refresh_token, redirect_path });
    const base =
      target === "partner" ? partnerUrl("/auth/handoff") :
      target === "admin" ? adminUrl("/auth/handoff") :
      target === "sales" ? salesUrl("/auth/handoff") :
      clientUrl("/auth/handoff");
    const url = `${base}?t=${encodeURIComponent(token)}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("handoff create failed:", e);
    return NextResponse.json({ error: "Failed to create handoff" }, { status: 500 });
  }
}
