import { NextResponse } from "next/server";

// Shared API response envelope. Routes use these instead of hand-writing
// NextResponse.json everywhere so success/error shapes stay consistent and DB
// internals never leak to clients.

// Success: returns the payload as JSON (200 by default).
export function ok<T>(data: T, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

// Error: always a safe, caller-supplied message — never a raw DB/stack string.
// `extra` allows structured detail (e.g. Zod flatten output) when intentional.
export function fail(
  message: string,
  status = 500,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}
