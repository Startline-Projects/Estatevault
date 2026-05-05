const proto = process.env.NODE_ENV === "production" ? "https" : "http";

const clientHost = process.env.NEXT_PUBLIC_CLIENT_HOST || "localhost:3000";
const partnerHost = process.env.NEXT_PUBLIC_PARTNER_HOST || "localhost:3000";

export const clientUrl = (path = "/") => `${proto}://${clientHost}${path}`;
export const partnerUrl = (path = "/") => `${proto}://${partnerHost}${path}`;

export function isPartnerHost(host: string | null | undefined): boolean {
  if (!host) return false;
  if (host === partnerHost) return true;
  return host.startsWith("pro.");
}

export function isClientHost(host: string | null | undefined): boolean {
  if (!host) return false;
  if (host === clientHost) return true;
  if (host.startsWith("app.")) return true;
  if (host === "localhost:3000" || host.startsWith("localhost")) return true;
  return false;
}

export function normalizeBusinessDomain(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/*/, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}
