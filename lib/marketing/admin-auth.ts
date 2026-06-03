import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";

// Re-exported so existing marketing callers keep importing it from here.
export { createAdminClient };

export async function requireAdmin(): Promise<
  | { ok: true; userId: string; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; status: number; error: string }
> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  if (prof?.user_type !== "admin") return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, userId: user.id, admin };
}

export const BUCKET = "marketing-materials";
