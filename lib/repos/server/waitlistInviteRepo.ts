// Server-side data access for the `waitlist_invites` table — pre-launch client
// invites a partner queues during onboarding (B2).

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;
type WaitlistInviteInsert = Database["public"]["Tables"]["waitlist_invites"]["Insert"];

// Queue a client invite for a partner.
export function insert(admin: Admin, row: WaitlistInviteInsert) {
  return admin.from("waitlist_invites").insert(row).select("id").single();
}
