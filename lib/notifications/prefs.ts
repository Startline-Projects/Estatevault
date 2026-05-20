import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKey =
  | "documents_delivered"
  | "annual_review"
  | "life_event_reminders";

/**
 * Returns whether a client wants a given notification.
 * Defaults to opt-in (true) when the profile or preference is missing —
 * matches the UI default in app/dashboard/settings/page.tsx.
 * A preference is only suppressed when explicitly set to false.
 */
export async function wantsNotification(
  supabase: SupabaseClient,
  profileId: string | null | undefined,
  key: NotificationKey,
): Promise<boolean> {
  if (!profileId) return true;
  const { data } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", profileId)
    .maybeSingle();
  const prefs = data?.notification_preferences as Record<string, boolean> | null | undefined;
  if (!prefs) return true;
  return prefs[key] !== false;
}
