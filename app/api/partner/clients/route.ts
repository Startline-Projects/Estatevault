import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { firstName, lastName, email, partnerId, action } = body;
  if (!firstName || !email || !partnerId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();

  // Create or find auth user for client
  let profileId: string;
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).single();

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: `${firstName} ${lastName || ""}`.trim(), user_type: "client" },
    });
    if (createErr || !newUser.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
    profileId = newUser.user.id;

    // Ensure profile exists
    const { data: check } = await admin.from("profiles").select("id").eq("id", profileId).single();
    if (!check) {
      await admin.from("profiles").insert({ id: profileId, email, full_name: `${firstName} ${lastName || ""}`.trim(), user_type: "client" });
    }
  }

  // Create client record linked to partner
  const { data: existingClient } = await admin.from("clients").select("id").eq("profile_id", profileId).eq("partner_id", partnerId).single();

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientErr } = await admin.from("clients").insert({
      profile_id: profileId,
      partner_id: partnerId,
      source: "partner",
      state: "Michigan",
    }).select("id").single();
    if (clientErr || !newClient) return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    clientId = newClient.id;
  }

  // Audit log
  await admin.from("audit_log").insert({ actor_id: user.id, action: action === "invite" ? "client.invited" : "client.session_started", resource_type: "client", resource_id: clientId, metadata: { partner_id: partnerId, client_email: email } });

  return NextResponse.json({ clientId, profileId });
}

// Add client note
export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, partnerId, note } = await request.json();
  if (!clientId || !partnerId || !note) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("client_notes").insert({ client_id: clientId, partner_id: partnerId, note });

  return NextResponse.json({ success: true });
}
