import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Receive CSP violation reports. Browsers POST application/csp-report or
// application/reports+json. Log to stderr for now; ship to a real ingestion
// pipeline (Sentry/Datadog) when Phase 15 QA wires it up.
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (body) {
      console.warn("[csp-report]", body.slice(0, 4000));
    }
  } catch {
    /* swallow — CSP reports must never error visibly */
  }
  return new NextResponse(null, { status: 204 });
}
