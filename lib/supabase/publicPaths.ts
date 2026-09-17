/**
 * Routes that need no session.
 *
 * Middleware answers 401 for any /api/ path that is not listed here and has no
 * signed-in user — before the route handler runs. So a route that an anonymous
 * page calls MUST be listed, or that page can never work.
 *
 * That is exactly how the emailed password-reset link broke: the reset page
 * calls /api/auth/exchange-reset-token for someone who, by definition, cannot
 * sign in, and the route was never added here. tests/unit/public-api-allowlist
 * now checks every anonymous call in lib/api-client/ against this list.
 *
 * Matching is by exact path or path prefix + "/" (see isPublicPath), so
 * "/api/checkout" covers "/api/checkout/will" but not "/api/checkoutx".
 */
export const PUBLIC_PATHS: readonly string[] = [
  // pages
  "/",
  "/quiz",
  "/will",
  "/trust",
  "/auth",
  "/attorney-referral",
  "/pro-partners",
  "/partners",
  "/professionals",
  "/farewell",
  "/khan-lawgroup",
  "/a",
  "/affiliate-signup",
  "/vault/trustee-confirm",
  "/trustee",
  // API routes — each one authenticates itself, or is safe to call anonymously
  "/api/webhooks",
  "/api/csp-report",
  "/api/documents/process",
  "/api/documents/cleanup-test-orders",
  "/api/documents/process-now",
  "/api/documents/regenerate-missing",
  "/api/documents/check-status",
  "/api/documents/download-by-session",
  "/api/attorney/check-sla",
  "/api/checkout",
  "/api/quiz",
  "/api/professionals",
  "/api/farewell",
  "/api/referrals",
  "/api/auth/set-password",
  "/api/auth/handoff",
  "/api/auth/signup",
  "/api/auth/recovery",
  "/api/auth/exchange-reset-token",
  "/api/auth/resend-verification",
  "/api/auth/check-email",
  "/api/auth/send-verify-code",
  "/api/auth/verify-code",
  "/api/auth/send-verify-link",
  "/api/auth/verify-link",
  "/api/auth/check-verification",
  "/api/affiliate",
  "/api/contact",
  "/api/vault/trustees",
  "/api/partners/branding",
  "/api/trustee",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
