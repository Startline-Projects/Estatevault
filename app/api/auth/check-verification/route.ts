import { NextResponse } from "next/server";
import { pollLink } from "@/lib/auth/emailVerification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, sessionId } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const session = String(sessionId || "").trim();

    if (!normalizedEmail || !session) {
      return NextResponse.json({ verified: false }, { status: 400 });
    }

    const token = pollLink(normalizedEmail, session);
    if (!token) {
      return NextResponse.json({ verified: false });
    }

    return NextResponse.json({ verified: true, token });
  } catch (err) {
    console.error("check-verification error:", err);
    return NextResponse.json({ verified: false }, { status: 500 });
  }
}
