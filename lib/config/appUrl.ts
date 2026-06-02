// B7 — single source of truth for the app's public URL. Historically read via
// three different env-var names (NEXT_PUBLIC_SITE_URL / _APP_URL / _BASE_URL),
// which built password-reset / verify links from inconsistent domains.
//
// Resolution order: SITE_URL → APP_URL → BASE_URL → environment default.
// Returns with no trailing slash so callers can safely append `/path`.
export function getAppUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production"
    ? "https://www.estatevault.us"
    : "http://localhost:3000";
}
