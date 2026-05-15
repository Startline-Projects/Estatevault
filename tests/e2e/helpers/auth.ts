import { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function adminClient() {
  return createClient(SB_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Logs in via Supabase password grant, then injects the session into the browser
 * using the cookie names @supabase/ssr expects. Avoids UI flakiness on login pages.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  try {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  } catch {}
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for any post-login route (router.push fires per user_type)
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 15_000 });
  // Park on a blank page so the test's next page.goto() is always a real
  // navigation that returns a response — goto() returns null when navigating
  // to the URL the page already sits on (e.g. login landed us on /dashboard).
  await page.goto("about:blank");
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
