import { describe, it, expect } from "vitest";
import {
  renderEmailHeader,
  renderEmailFooter,
  buildAssetChecklist,
  type EmailBrand,
} from "@/lib/email";

const evBrand: EmailBrand = { companyName: "EstateVault", logoUrl: "https://example.com/logo.png", isPartner: false };
const partnerBrand: EmailBrand = { companyName: "Acme Legal", logoUrl: "https://acme.com/logo.png", isPartner: true };
const noLogoBrand: EmailBrand = { companyName: "TestFirm", logoUrl: null, isPartner: true };

describe("renderEmailHeader", () => {
  it("renders logo img when logoUrl is present", () => {
    const html = renderEmailHeader(evBrand);
    expect(html).toContain("<img");
    expect(html).toContain("https://example.com/logo.png");
    expect(html).toContain('alt="EstateVault"');
  });

  it("renders text fallback when logoUrl is null", () => {
    const html = renderEmailHeader(noLogoBrand);
    expect(html).not.toContain("<img");
    expect(html).toContain("TestFirm");
  });

  it("escapes double quotes in company name", () => {
    const brand: EmailBrand = { companyName: 'Test "Firm"', logoUrl: "x.png", isPartner: false };
    const html = renderEmailHeader(brand);
    expect(html).toContain("&quot;");
    expect(html).not.toContain('alt="Test "Firm""');
  });

  it("uses navy background color", () => {
    const html = renderEmailHeader(evBrand);
    expect(html).toContain("#1C3557");
  });
});

describe("renderEmailFooter", () => {
  it("shows 'Powered by EstateVault' for partners", () => {
    const html = renderEmailFooter(partnerBrand);
    expect(html).toContain("Powered by EstateVault");
    expect(html).toContain("Acme Legal");
  });

  it("does NOT show 'Powered by' for non-partners", () => {
    const html = renderEmailFooter(evBrand);
    expect(html).not.toContain("Powered by EstateVault");
    expect(html).toContain("EstateVault Technologies LLC");
  });

  it("includes extra content when provided", () => {
    const html = renderEmailFooter(evBrand, "<p>Extra disclaimer</p>");
    expect(html).toContain("Extra disclaimer");
  });

  it("includes current year copyright", () => {
    const html = renderEmailFooter(evBrand);
    expect(html).toContain(String(new Date().getFullYear()));
  });
});

describe("buildAssetChecklist", () => {
  it("maps known assets to instructions", () => {
    const result = buildAssetChecklist(["Primary home / real estate in Michigan"]);
    expect(result).toHaveLength(1);
    expect(result[0].asset).toBe("Primary home");
    expect(result[0].instruction).toContain("Quit Claim Deed");
  });

  it("returns 'See instructions' for unknown assets", () => {
    const result = buildAssetChecklist(["Alien artifacts"]);
    expect(result[0].instruction).toBe("See instructions");
  });

  it("handles multiple assets", () => {
    const result = buildAssetChecklist([
      "Bank and investment accounts",
      "Vehicles",
      "Digital assets and cryptocurrency",
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].instruction).toContain("retitle");
    expect(result[1].instruction).toContain("$60,000");
    expect(result[2].instruction).toContain("digital asset");
  });

  it("returns empty array for no assets", () => {
    expect(buildAssetChecklist([])).toEqual([]);
  });

  it("strips suffix after ' / ' from asset name", () => {
    const result = buildAssetChecklist(["Real estate in another state"]);
    expect(result[0].asset).toBe("Real estate in another state");
  });
});
