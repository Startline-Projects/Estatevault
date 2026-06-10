// BUG-12 fix verification — app/api/vault/farewell/[id]/signed-url.
//
// Before the fix, a non-owner could mint a 7-day signed URL to another
// client's farewell video as long as the message was "unlocked". The fix
// removes the non-owner branch: only message.client_id === client.id may mint
// a URL, otherwise 404 (existence hidden). These tests assert the FIXED
// behavior — the non-owner cases must 404 and must NOT create a signed URL.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks (hoisted) -------------------------------------------------------
const { getIdByProfile, getById, createSignedUrl, auditInsert } = vi.hoisted(() => ({
  getIdByProfile: vi.fn(),
  getById: vi.fn(),
  createSignedUrl: vi.fn(),
  auditInsert: vi.fn(),
}));

// admin client used by the route: storage.createSignedUrl + audit_log insert
const admin = {
  storage: { from: () => ({ createSignedUrl }) },
  from: () => ({ insert: auditInsert }),
};

vi.mock("@/lib/api/auth", () => ({
  requireAuth: vi.fn(async () => ({
    user: { id: "user-1", email: "owner@example.com" },
    profile: { id: "profile-1", user_type: "client" },
    admin,
  })),
}));

vi.mock("@/lib/repos/server/clientRepo", () => ({
  getIdByProfile: (...a: unknown[]) => getIdByProfile(...a),
}));
vi.mock("@/lib/repos/server/farewellRepo", () => ({
  getById: (...a: unknown[]) => getById(...a),
}));

import { GET } from "@/app/api/vault/farewell/[id]/signed-url/route";

// ---- Helpers ---------------------------------------------------------------
const OWNER = "client-owner";
const ATTACKER = "client-attacker";

function call(messageId = "msg-1") {
  const req = new Request(`http://localhost/api/vault/farewell/${messageId}/signed-url`);
  return GET(req as never, { params: Promise.resolve({ id: messageId }) });
}

function asClient(id: string) {
  getIdByProfile.mockResolvedValue({ data: { id } });
}

function withMessage(status: string, clientId = OWNER) {
  getById.mockResolvedValue({
    data: {
      client_id: clientId,
      storage_path: `vault/${clientId}/video.bin`,
      vault_farewell_status: status,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/video" } });
  auditInsert.mockResolvedValue({ error: null });
});

// ---- Tests -----------------------------------------------------------------
describe("BUG-12 — farewell signed-url owner gate", () => {
  it("owner gets a signed URL (200)", async () => {
    asClient(OWNER);
    withMessage("ready", OWNER);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe("https://signed/video");
    expect(createSignedUrl).toHaveBeenCalledOnce();
  });

  it("non-owner is REFUSED even when the video is unlocked (was the leak)", async () => {
    asClient(ATTACKER);
    withMessage("unlocked", OWNER);

    const res = await call();
    expect(res.status).toBe(404);
    // critical: no signed URL ever minted for a non-owner
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("non-owner is refused for a locked video too (404, not 403 — hide existence)", async () => {
    asClient(ATTACKER);
    withMessage("ready", OWNER);

    const res = await call();
    expect(res.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("audit log records owner_viewed for the owner path", async () => {
    asClient(OWNER);
    withMessage("ready", OWNER);

    await call();
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "farewell.owner_viewed" }),
    );
  });
});
