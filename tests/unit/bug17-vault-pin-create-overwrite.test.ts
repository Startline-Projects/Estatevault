// BUG-17 — Vault PIN "create" overwrote an existing PIN without the old one.
//
// The PIN is a second factor over the session. The "create" action hashed and
// wrote vault_pin_hash unconditionally, so anyone holding only the session
// could re-create the PIN to a known value and bypass the gate. The fix: if a
// PIN already exists, "create" must reject (409) and never write — overwriting
// requires the "change" flow, which bcrypt.compares the current PIN first.
// These tests assert the CORRECT (post-fix) behavior.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ---- Mocks (hoisted) -------------------------------------------------------

const { requireAuthMock } = vi.hoisted(() => ({ requireAuthMock: vi.fn() }));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

import { POST } from "@/app/api/vault/pin/route";

// ---- Fake admin (Supabase) client -----------------------------------------

function makeAdmin(profileRow: { vault_pin_hash: string | null } | null) {
  const updateSpy = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profileRow }) }) }),
        update: (vals: unknown) => updateSpy(vals),
      };
    }
    // audit_log
    return { insert: (vals: unknown) => insertSpy(vals) };
  });
  return { admin: { from }, updateSpy, insertSpy };
}

async function callPost(body: Record<string, unknown>) {
  const req = new Request("https://ev.test/api/vault/pin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as never);
}

// ---- Tests -----------------------------------------------------------------

describe("vault/pin — BUG-17 create cannot overwrite an existing PIN", () => {
  let existingHash: string;

  beforeAll(async () => {
    existingHash = await bcrypt.hash("123456", 10);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("first-time create (no PIN yet) writes the hash and audits it", async () => {
    const { admin, updateSpy, insertSpy } = makeAdmin({ vault_pin_hash: null });
    requireAuthMock.mockResolvedValue({ user: { id: "u1" }, admin });

    const res = await callPost({ action: "create", pin: "111111" });

    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const vals = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(vals).toHaveProperty("vault_pin_hash");
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const audit = insertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(audit).toHaveProperty("action", "vault.pin_created");
  });

  it("create when a PIN already exists is rejected (409) and never overwrites", async () => {
    const { admin, updateSpy, insertSpy } = makeAdmin({ vault_pin_hash: existingHash });
    requireAuthMock.mockResolvedValue({ user: { id: "u1" }, admin });

    const res = await callPost({ action: "create", pin: "999999" });

    // The core BUG-17 guarantee: no write, no audit, force the change flow.
    expect(res.status).toBe(409);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("change still overwrites — but only with the correct current PIN", async () => {
    const { admin, updateSpy } = makeAdmin({ vault_pin_hash: existingHash });
    requireAuthMock.mockResolvedValue({ user: { id: "u1" }, admin });

    const ok = await callPost({ action: "change", pin: "123456", newPin: "222222" });
    expect(ok.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("change with the wrong current PIN is rejected (422) and does not write", async () => {
    const { admin, updateSpy } = makeAdmin({ vault_pin_hash: existingHash });
    requireAuthMock.mockResolvedValue({ user: { id: "u1" }, admin });

    const res = await callPost({ action: "change", pin: "000000", newPin: "222222" });
    expect(res.status).toBe(422);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
