"use client";

import { createClient } from "@/lib/supabase/client";

// Wraps fetch for internal API calls that require an authenticated Supabase
// session. The access token expires (~1 hr) while a page sits open; the next
// authed request then gets blocked by middleware with a 401 ("unauthorized")
// before it ever reaches the route. On a 401 we refresh the session once and
// retry. If it still fails, the session is genuinely gone — redirect to login
// with a return path so the user lands back where they were.
//
// Only use for same-origin internal API routes (not Supabase Storage signed
// URLs — those are not gated by our middleware and won't return our 401).
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, init);
  if (res.status !== 401) return res;

  // Token likely expired — try a single refresh, then retry the request.
  const supabase = createClient();
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    redirectToLogin();
    throw new SessionExpiredError();
  }

  res = await fetch(input, init);
  if (res.status === 401) {
    redirectToLogin();
    throw new SessionExpiredError();
  }
  return res;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  window.location.href = `/auth/login?redirect=${encodeURIComponent(here)}`;
}
