import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/auth/emailVerification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();

    if (!normalizedEmail || !normalizedCode) {
      return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
    }

    const result = verifyCode(normalizedEmail, normalizedCode);

    if (!result.ok) {
      const reasonMap: Record<typeof result.reason, string> = {
        expired: "Code expired. Request a new one.",
        invalid: "Incorrect code. Try again.",
        too_many: "Too many attempts. Request a new code.",
        not_requested: "No code requested. Click Send Code first.",
      };
      return NextResponse.json(
        { error: reasonMap[result.reason] },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, token: result.token });
  } catch (err) {
    console.error("verify-code error:", err);
    return NextResponse.json({ error: "Failed to verify code." }, { status: 500 });
  }
}
