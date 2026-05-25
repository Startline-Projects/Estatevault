import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withRoute } from "@/lib/api/route";

describe("response.ok", () => {
  it("returns the payload as JSON with 200 by default", async () => {
    const res = ok({ items: [1, 2] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [1, 2] });
  });

  it("honors a custom status", () => {
    expect(ok({ created: true }, { status: 201 }).status).toBe(201);
  });
});

describe("response.fail", () => {
  it("wraps a safe message under { error } with a status", async () => {
    const res = fail("nope", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "nope" });
  });

  it("defaults to 500 and merges extra detail", async () => {
    const res = fail("invalid payload", 400, { details: { field: "x" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid payload", details: { field: "x" } });
  });
});

describe("withRoute", () => {
  const makeReq = () => new NextRequest("https://ev.test/api/vault/items", { method: "GET" });

  it("passes a normal response through unchanged", async () => {
    const handler = withRoute(async () => ok({ ok: true }));
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("turns an unexpected throw into a generic 500 (no leak)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withRoute(async () => {
      throw new Error("secret db column constraint blew up");
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("forwards extra handler args (e.g. dynamic route params)", async () => {
    const handler = withRoute(async (_req, ctx: { params: { id: string } }) =>
      ok({ id: ctx.params.id }),
    );
    const res = await handler(makeReq(), { params: { id: "abc" } });
    expect(await res.json()).toEqual({ id: "abc" });
  });

  it("returns a NextResponse instance", async () => {
    const handler = withRoute(async () => ok({}));
    const res = await handler(makeReq());
    expect(res).toBeInstanceOf(NextResponse);
  });
});
