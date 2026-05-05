import { NextResponse } from "next/server";
import { decryptHandoff } from "@/lib/handoff";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    const payload = decryptHandoff(token);
    return NextResponse.json({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      redirect_path: payload.redirect_path,
    });
  } catch (e) {
    console.error("handoff consume failed:", e);
    return NextResponse.json({ error: "Invalid or expired handoff token" }, { status: 400 });
  }
}
