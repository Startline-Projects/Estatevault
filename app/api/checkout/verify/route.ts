import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    const attorneyReview = session.metadata?.attorney_review === "true";
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const email = session.customer_details?.email || "";

    // Look up the userId from profiles table — retry in case webhook is still processing
    let userId = "";
    let hasExistingAccount = false;
    if (email) {
      const supabase = createAdminClient();
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();
        if (profile) {
          userId = profile.id;

          // Check if this user has ever signed in (i.e., has a password set)
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          if (authUser?.user?.last_sign_in_at) {
            hasExistingAccount = true;
          }

          break;
        }
        // Wait 1 second before retrying
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    return NextResponse.json({
      success: true,
      attorneyReview,
      amount,
      orderId: session.metadata?.order_id,
      email,
      userId,
      hasExistingAccount,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to verify payment session" },
      { status: 500 }
    );
  }
}
