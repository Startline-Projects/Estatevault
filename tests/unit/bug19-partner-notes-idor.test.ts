// BUG-19 fix verification — app/api/sales/partner-notes (GET + POST).
//
// Before the fix, GET took ?partnerId= and returned a partner's private deal
// notes with NO ownership scoping, and POST inserted notes against any
// partnerId. A sales rep could pass a partner they don't own (guessable UUID)
// and read/write another rep's confidential notes. The fix scopes both verbs:
// a non-admin rep may only touch partners where partner.created_by === their
// user id. Admins keep full access. These tests assert the FIXED behavior.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks (hoisted) -------------------------------------------------------
const { requireAuth, getById } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getById: vi.fn(),
}));

// admin client used by the route: from("sales_partner_notes").select().eq().order()
// for GET, and .insert() for POST.
const order = vi.fn().mockResolvedValue({ data: [{ id: "n1", note: "secret deal note" }] });
const eq = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ eq }));
const insert = vi.fn().mockResolvedValue({ error: null });
const adminFrom = vi.fn(() => ({ select, insert }));
const admin = { from: adminFrom };

vi.mock("@/lib/api/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/repos/server/partnerRepo", () => ({ getById: (...a: unknown[]) => getById(...a) }));

import { GET, POST } from "@/app/api/sales/partner-notes/route";

// ---- Helpers ---------------------------------------------------------------
const REP = "rep-1";
const OTHER_REP = "rep-2";
const PARTNER = "partner-1";

function asRep(userId: string) {
  requireAuth.mockResolvedValue({ user: { id: userId }, profile: { user_type: "sales_rep" }, admin });
}
function asAdmin() {
  requireAuth.mockResolvedValue({ user: { id: "admin-1" }, profile: { user_type: "admin" }, admin });
}
function partnerOwnedBy(createdBy: string) {
  getById.mockResolvedValue({ data: { id: PARTNER, created_by: createdBy } });
}

function getReq(partnerId = PARTNER) {
  return GET(new Request(`http://localhost/api/sales/partner-notes?partnerId=${partnerId}`) as never);
}
function postReq(partnerId = PARTNER) {
  const req = new Request("http://localhost/api/sales/partner-notes", {
    method: "POST",
    body: JSON.stringify({ partnerId, note: "hello" }),
  });
  return POST(req as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  order.mockResolvedValue({ data: [{ id: "n1", note: "secret deal note" }] });
  insert.mockResolvedValue({ error: null });
});

// ---- Tests -----------------------------------------------------------------
describe("BUG-19 — partner-notes ownership scoping", () => {
  it("GET: owning rep gets the notes (200)", async () => {
    asRep(REP);
    partnerOwnedBy(REP);

    const res = await getReq();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toHaveLength(1);
    expect(select).toHaveBeenCalled();
  });

  it("GET: non-owner rep gets empty notes and the table is never queried (was the leak)", async () => {
    asRep(OTHER_REP);
    partnerOwnedBy(REP); // partner belongs to REP, caller is OTHER_REP

    const res = await getReq();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it("GET: admin reads any partner's notes without an ownership lookup", async () => {
    asAdmin();

    const res = await getReq();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toHaveLength(1);
    expect(getById).not.toHaveBeenCalled();
  });

  it("POST: non-owner rep is refused (404) and no note is written (was the write leak)", async () => {
    asRep(OTHER_REP);
    partnerOwnedBy(REP);

    const res = await postReq();
    expect(res.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  it("POST: owning rep writes a note (200)", async () => {
    asRep(REP);
    partnerOwnedBy(REP);

    const res = await postReq();
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ partner_id: PARTNER, sales_rep_id: REP, note: "hello" }),
    );
  });
});
