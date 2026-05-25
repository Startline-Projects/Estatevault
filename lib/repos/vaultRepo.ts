"use client";

// Option A (server-managed encryption): the server encrypts/decrypts. This repo
// sends and receives PLAINTEXT over TLS; no client-side crypto.

export type VaultCategory =
  | "estate_document" | "insurance" | "financial_account" | "digital_account"
  | "physical_location" | "contact" | "final_wishes" | "business";

export type VaultItemPlaintext = {
  id: string;
  category: VaultCategory;
  label: string;
  data: Record<string, unknown>;
  storagePath: string | null;
  encrypted: boolean;
  createdAt: string;
};

type ServerItem = {
  id: string;
  category: VaultCategory;
  label: string;
  data: Record<string, unknown>;
  storagePath: string | null;
  encrypted: boolean;
  createdAt: string;
};

export async function listItems(): Promise<VaultItemPlaintext[]> {
  const res = await fetch("/api/vault/items");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { items } = await res.json() as { items: ServerItem[] };
  return items.map((r) => ({
    id: r.id,
    category: r.category,
    label: r.label ?? "",
    data: r.data ?? {},
    storagePath: r.storagePath ?? null,
    encrypted: r.encrypted ?? true,
    createdAt: r.createdAt,
  }));
}

export async function createItem(args: {
  category: VaultCategory;
  label: string;
  data: Record<string, unknown>;
  storagePath?: string | null;
}): Promise<{ id: string }> {
  const res = await fetch("/api/vault/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: args.category,
      label: args.label,
      data: args.data,
      storagePath: args.storagePath ?? undefined,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `create failed: ${res.status}`);
  }
  const { item } = await res.json() as { item: { id: string } };
  return item;
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/vault/items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `delete failed: ${res.status}`);
  }
}

export async function searchByLabel(label: string, category?: VaultCategory): Promise<{ id: string; category: VaultCategory }[]> {
  const res = await fetch("/api/vault/items/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, category }),
  });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const { items } = await res.json() as { items: { id: string; category: VaultCategory }[] };
  return items;
}
