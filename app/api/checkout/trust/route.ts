import { withRoute } from "@/lib/api/route";
import { trustCheckoutSchema } from "@/lib/validation/schemas";
import { createCheckoutSession } from "@/lib/checkout/createCheckoutSession";
import { PRICES, EV_DEFAULT_CUT } from "@/lib/orders/pricing";
import { NextResponse } from "next/server";
import type { ProductConfig } from "@/lib/checkout/createCheckoutSession";

const TRUST_CONFIG: ProductConfig = {
  productType: "trust",
  baseAmount: PRICES.trust,
  defaultEvCut: EV_DEFAULT_CUT.trust,
  docTypes: ["trust", "pour_over_will", "poa", "healthcare_directive"],
  recommendation: "trust",
  stripeName: "Trust Package",
  stripeDescription:
    "Revocable Living Trust, Pour-Over Will, Power of Attorney, Healthcare Directive, Asset Funding Checklist, Family Vault Access",
  attorneyDescription:
    "Licensed Michigan attorney review of your trust documents (48hr turnaround)",
  successPath: "/trust/success",
  cancelPath: "/trust/checkout",
};

export const POST = withRoute(async (request: Request) => {
  const body = await request.json();
  const parsed = trustCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
    return NextResponse.json(
      { error: `Validation failed — ${issues.join("; ")}`, details: parsed.error.format() },
      { status: 400 },
    );
  }
  return createCheckoutSession(request, TRUST_CONFIG, parsed.data);
});
