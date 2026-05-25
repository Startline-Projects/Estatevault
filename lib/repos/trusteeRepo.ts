"use client";

// Option A: trustee details are encrypted server-side. This repo sends/receives
// PLAINTEXT over TLS.

export type AccessScope = {
  categories: string[];
  documents: boolean;
  farewell: boolean;
};

export const FULL_SCOPE: AccessScope = {
  categories: [
    "estate_document", "financial_account", "insurance", "digital_account",
    "physical_location", "contact", "business", "final_wishes",
  ],
  documents: true,
  farewell: true,
};

export type TrusteePlaintext = {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: string;
  encrypted: boolean;
  invite_sent_at: string | null;
  confirmed_at: string | null;
  accessScope: AccessScope;
};

type ServerTrustee = {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: string;
  invite_sent_at: string | null;
  confirmed_at: string | null;
  access_scope: AccessScope | null;
};

function normalizeScope(s: AccessScope | null | undefined): AccessScope {
  if (!s) return FULL_SCOPE;
  return {
    categories: Array.isArray(s.categories) ? s.categories : [],
    documents: !!s.documents,
    farewell: !!s.farewell,
  };
}

export async function listTrustees(): Promise<TrusteePlaintext[]> {
  const res = await fetch("/api/vault/trustees");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { trustees } = await res.json() as { trustees: ServerTrustee[] };
  return trustees.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    relationship: r.relationship ?? "",
    status: r.status,
    encrypted: true,
    invite_sent_at: r.invite_sent_at,
    confirmed_at: r.confirmed_at,
    accessScope: normalizeScope(r.access_scope),
  }));
}

export type AddTrusteeArgs = {
  name: string;
  email: string;
  relationship: string;
  accessScope: AccessScope;
};

export async function addTrustee(args: AddTrusteeArgs): Promise<void> {
  const res = await fetch("/api/vault/trustees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: args.name,
      email: args.email,
      relationship: args.relationship,
      access_scope: args.accessScope,
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `add trustee failed: ${res.status}`);
  }
}

export async function deleteTrustee(id: string): Promise<void> {
  const res = await fetch(`/api/vault/trustees?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete trustee failed: ${res.status}`);
}
