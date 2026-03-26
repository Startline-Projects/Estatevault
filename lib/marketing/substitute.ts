export interface PartnerData {
  companyName: string;
  productName: string;
  partnerName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  businessUrl: string;
  logoUrl: string;
  accentColor: string;
}

export function substituteTokens(template: string, data: PartnerData): string {
  const map: Record<string, string> = {
    "[Company Name]": data.companyName || "Your Company",
    "[Product Name]": data.productName || "Legacy Protection",
    "[Partner Name]": data.partnerName || "",
    "[Phone]": data.phone || "",
    "[Email]": data.email || "",
    "[City]": data.city || "your city",
    "[CityName]": data.city || "YourCity",
    "[State]": data.state || "Michigan",
    "[white-label URL]": data.businessUrl ? `legacy.${data.businessUrl}` : "estatevault.com",
    "[Logo]": data.logoUrl || "",
    "[Accent Color]": data.accentColor || "#C9A84C",
  };

  let result = template;
  for (const [token, value] of Object.entries(map)) {
    result = result.split(token).join(value);
  }
  return result;
}
