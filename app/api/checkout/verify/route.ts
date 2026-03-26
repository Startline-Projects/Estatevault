import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

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

    return NextResponse.json({
      success: true,
      attorneyReview,
      amount,
      orderId: session.metadata?.order_id,
      email: session.customer_details?.email || "",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to verify payment session" },
      { status: 500 }
    );
  }
}
