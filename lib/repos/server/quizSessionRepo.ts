// Server-side data access for the `quiz_sessions` table — the only place that
// queries it from the API layer.

import { createAdminClient } from "@/lib/api/auth";
import type { Database } from "@/types/db.generated";

type Admin = ReturnType<typeof createAdminClient>;
type QuizSessionInsert = Database["public"]["Tables"]["quiz_sessions"]["Insert"];

// Insert a quiz/intake session row.
export function insert(admin: Admin, row: QuizSessionInsert) {
  return admin.from("quiz_sessions").insert(row);
}

// Insert and return the new row id (callers that link it to an order).
export function insertReturningId(admin: Admin, row: QuizSessionInsert) {
  return admin.from("quiz_sessions").insert(row).select("id").single();
}

// Latest quiz answers for a client (webhook needs this for intake data).
export function getLatestAnswersByClient(admin: Admin, clientId: string) {
  return admin
    .from("quiz_sessions")
    .select("id, answers")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
}

// Latest trust-recommended quiz answers for a client (B2 funding checklist).
export function getLatestTrustAnswersByClient(admin: Admin, clientId: string) {
  return admin
    .from("quiz_sessions")
    .select("answers")
    .eq("client_id", clientId)
    .eq("recommendation", "trust")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}
