import { createAdminClient } from "@/lib/api/auth";

// Shared admin-client type for the Stripe webhook handlers (extracted from the
// former monolithic app/api/webhooks/stripe/route.ts).
export type Admin = ReturnType<typeof createAdminClient>;
