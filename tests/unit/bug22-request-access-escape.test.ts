// BUG-22 fix verification — app/api/professionals/request-access.
//
// Before the fix, lead fields (companyName, names, etc.) were interpolated RAW
// into the sales-notification + confirmation HTML emails (the sibling contact
// route escaped; this one didn't), and the schema had no length caps. The fix
// escapes every interpolated field via the shared escapeHtml and bounds all
// string fields. These tests assert the FIXED behavior.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks (hoisted) -------------------------------------------------------
const { sendMock, insertMock } = vi.hoisted(() => {
  // The route gates both emails on these env vars, read at call time.
  process.env.RESEND_API_KEY = "re_test";
  process.env.SALES_NOTIFICATION_EMAIL = "sales@estatevault.us";
  return { sendMock: vi.fn(), insertMock: vi.fn() };
});

// Stub getResend (capturable send) but keep the real escapeHtml semantics.
vi.mock("@/lib/email", () => ({
  getResend: () => ({ emails: { send: sendMock } }),
  escapeHtml: (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
}));

vi.mock("@/lib/api/auth", () => ({
  createAdminClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

import { POST } from "@/app/api/professionals/request-access/route";

const valid = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  professionalType: "attorney",
  companyName: "Doe Law",
};

function post(body: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/professionals/request-access", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
  insertMock.mockResolvedValue({ error: null });
});

describe("BUG-22 — request-access HTML escaping + bounds", () => {
  it("escapes an HTML payload in companyName (no raw tag in the sales email)", async () => {
    const res = await post({ ...valid, companyName: '<img src=x onerror=alert(1)>' });
    expect(res.status).toBe(200);

    const salesHtml = sendMock.mock.calls[0][0].html as string;
    expect(salesHtml).not.toContain("<img src=x onerror");
    expect(salesHtml).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes a payload in firstName in both emails", async () => {
    await post({ ...valid, firstName: '<script>bad</script>' });
    const allHtml = sendMock.mock.calls.map((c) => c[0].html as string).join("\n");
    expect(allHtml).not.toContain("<script>bad</script>");
    expect(allHtml).toContain("&lt;script&gt;bad&lt;/script&gt;");
  });

  it("rejects an oversized field (400) and sends nothing", async () => {
    const res = await post({ ...valid, firstName: "a".repeat(5000) });
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("accepts a normal lead (200) and sends the notification", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalled();
  });
});
