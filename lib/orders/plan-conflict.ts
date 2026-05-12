import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductType = "will" | "trust";
export type ConflictAction = "none" | "block" | "override";

export interface ConflictResult {
  hasWill: boolean;
  hasTrust: boolean;
  action: ConflictAction;
  message: string;
}

const OWNED_STATUSES = ["paid", "generating", "review", "delivered"];

export async function checkPlanConflict(
  supabase: SupabaseClient,
  email: string,
  productType: ProductType
): Promise<ConflictResult> {
  const normalized = email.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (!profile) {
    return { hasWill: false, hasTrust: false, action: "none", message: "" };
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id);

  const clientIds = (clients || []).map((c) => c.id);
  if (clientIds.length === 0) {
    return { hasWill: false, hasTrust: false, action: "none", message: "" };
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("product_type, status")
    .in("client_id", clientIds)
    .in("status", OWNED_STATUSES)
    .in("product_type", ["will", "trust"]);

  const hasWill = (orders || []).some((o) => o.product_type === "will");
  const hasTrust = (orders || []).some((o) => o.product_type === "trust");

  if (productType === "will") {
    if (hasTrust) {
      return {
        hasWill,
        hasTrust,
        action: "block",
        message:
          "You already have a Trust Package on this account, which includes a Will. You don't need to buy a Will Package. If you're buying for someone else, please use a different email.",
      };
    }
    if (hasWill) {
      return {
        hasWill,
        hasTrust,
        action: "block",
        message:
          "You already have a Will Package on this account. If you're buying for someone else, please use a different email.",
      };
    }
    return { hasWill, hasTrust, action: "none", message: "" };
  }

  // productType === "trust"
  if (hasTrust) {
    return {
      hasWill,
      hasTrust,
      action: "block",
      message:
        "You already have a Trust Package on this account. If you're buying for someone else, please use a different email.",
    };
  }
  if (hasWill) {
    return {
      hasWill,
      hasTrust,
      action: "override",
      message:
        "You already have a Will Package on this account. The Trust Package includes a Will, so your existing Will will be replaced. Continue?",
    };
  }
  return { hasWill, hasTrust, action: "none", message: "" };
}
