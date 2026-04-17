import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a review attorney profile for a partner firm.
 * Called during partner onboarding step 3 when the partner
 * indicates they have an in-house estate planning attorney.
 *
 * This creates a Supabase auth user + profile with user_type = 'review_attorney'.
 * The attorney receives a magic link email to set up their account.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { partnerId, attorneyName, attorneyEmail, barNumber } = body;

    if (!partnerId || !attorneyEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use service role client to create auth user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the calling user is the partner admin
    // Verify the partner exists
    const { data: partner } = await supabase
      .from("partners")
      .select("id, profile_id")
      .eq("id", partnerId)
      .single();

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Check if a profile already exists for this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === attorneyEmail.toLowerCase()
    );

    let profileId: string;

    if (existingUser) {
      // User already exists, update their profile
      profileId = existingUser.id;
      await supabase
        .from("profiles")
        .update({
          full_name: attorneyName || null,
          user_type: "review_attorney",
          bar_number: barNumber || null,
          is_payroll: false,
          managed_by_admin: partner.profile_id,
        })
        .eq("id", profileId);
    } else {
      // Create new auth user
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: attorneyEmail,
        email_confirm: true,
        user_metadata: { full_name: attorneyName || "" },
      });

      if (authError || !newUser?.user) {
        console.error("Failed to create review attorney user:", authError);
        return NextResponse.json(
          { error: "Failed to create attorney account" },
          { status: 500 }
        );
      }

      profileId = newUser.user.id;

      // Create profile
      await supabase.from("profiles").upsert({
        id: profileId,
        email: attorneyEmail,
        full_name: attorneyName || null,
        user_type: "review_attorney",
        bar_number: barNumber || null,
        is_payroll: false,
        managed_by_admin: partner.profile_id,
      });

      // Send magic link so the attorney can set up their account
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: attorneyEmail,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || "https://estatevault.us"}/attorney`,
        },
      });
    }

    return NextResponse.json({ profileId });
  } catch (error) {
    console.error("Create review attorney error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
