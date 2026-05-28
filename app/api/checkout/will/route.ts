import { withRoute } from "@/lib/api/route";
import { willCheckoutSchema } from "@/lib/validation/schemas";
import { createCheckoutSession } from "@/lib/checkout/createCheckoutSession";
import { PRICES, EV_DEFAULT_CUT } from "@/lib/orders/pricing";
import { NextResponse } from "next/server";
import type { ProductConfig } from "@/lib/checkout/createCheckoutSession";

const WILL_CONFIG: ProductConfig = {
  productType: "will",
  baseAmount: PRICES.will,
  defaultEvCut: EV_DEFAULT_CUT.will,
  docTypes: ["will", "poa", "healthcare_directive"],
  recommendation: "will",
  stripeName: "Will Package",
  stripeDescription:
    "Last Will & Testament, Power of Attorney, Healthcare Directive, Execution Guide, Family Vault Access",
  attorneyDescription:
    "Licensed Michigan attorney review of your documents (48hr turnaround)",
  successPath: "/will/success",
  cancelPath: "/will/checkout",
};

export const POST = withRoute(async (request: Request) => {
  const body = await request.json();
  const parsed = willCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing intake answers", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  return createCheckoutSession(request, WILL_CONFIG, parsed.data);
});
