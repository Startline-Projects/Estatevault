import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existingProfile, error: existingProfileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfileErr) {
      return NextResponse.json({ error: "Unable to validate existing account." }, { status: 500 });
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: (fullName || "").trim(), user_type: "client" },
    });

    if (createErr || !newUser.user) {
      return NextResponse.json(
        { error: createErr?.message || "Failed to create account." },
        { status: 500 }
      );
    }

    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: newUser.user.id,
      email: normalizedEmail,
      full_name: (fullName || "").trim() || null,
      user_type: "client",
    });

    if (upsertErr) {
      return NextResponse.json({ error: "Failed to finalize profile setup." }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: newUser.user.id });
  } catch (error) {
    console.error("Signup route error:", error);
    return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
  }
}
