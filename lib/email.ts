import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

interface SendDocumentEmailParams {
  to: string;
  productType: "will" | "trust";
  passwordLink: string;
  assetChecklist?: { asset: string; instruction: string }[];
}

const ASSET_INSTRUCTIONS: Record<string, string> = {
  "Primary home / real estate in Michigan": "Transfer via Michigan Quit Claim Deed",
  "Real estate in another state": "Transfer deed in each applicable state",
  "Bank and investment accounts": "Contact your bank to retitle accounts",
  "Business interests": "See instructions for business entity retitling",
  "Vehicles": "Michigan title transfer required",
  "Personal property and valuables": "Assignment of personal property to trust",
  "Digital assets and cryptocurrency": "See digital asset instructions",
};

export function buildAssetChecklist(assetTypes: string[]): { asset: string; instruction: string }[] {
  return assetTypes.map((asset) => ({
    asset: asset.split(" / ")[0],
    instruction: ASSET_INSTRUCTIONS[asset] || "See instructions",
  }));
}

function buildEmailHtml({
  productType,
  passwordLink,
  assetChecklist,
}: Omit<SendDocumentEmailParams, "to">): string {
  const packageName = productType === "will" ? "Will Package" : "Trust Package";
  const documents =
    productType === "will"
      ? ["Last Will & Testament", "Durable Power of Attorney", "Healthcare Directive", "Execution Guide"]
      : ["Revocable Living Trust", "Pour-Over Will", "Durable Power of Attorney", "Healthcare Directive", "Asset Funding Checklist"];

  const documentListHtml = documents
    .map((doc) => `<li style="padding:6px 0;color:#2D2D2D;font-size:14px;">✓ ${doc}</li>`)
    .join("");

  let assetChecklistHtml = "";
  if (productType === "trust" && assetChecklist && assetChecklist.length > 0) {
    const items = assetChecklist
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1C3557;font-weight:600;">☐ ${item.asset}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">${item.instruction}</td>
          </tr>`
      )
      .join("");

    assetChecklistHtml = `
      <div style="margin-top:32px;padding:24px;background:#f8f9fa;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:18px;color:#1C3557;">Asset Funding Checklist</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#666;">Your trust is only complete when your assets are inside it.</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;font-size:13px;color:#1C3557;">Asset</th>
              <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;font-size:13px;color:#1C3557;">Action Required</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#1C3557;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">EstateVault</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Your ${packageName} is ready.</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your documents have been generated and are saved in your account.
        Click the button below to set your password and access your documents.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${passwordLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Set Your Password & View Documents
        </a>
      </div>

      <!-- Documents included -->
      <div style="margin-top:32px;padding:24px;background:#f8f9fa;border-radius:12px;">
        <h3 style="margin:0 0 12px;font-size:16px;color:#1C3557;">Documents Included:</h3>
        <ul style="margin:0;padding:0;list-style:none;">
          ${documentListHtml}
        </ul>
        <p style="margin:12px 0 0;font-size:12px;color:#999;">
          Document downloads are available in your account dashboard.
        </p>
      </div>

      ${assetChecklistHtml}

      <p style="margin:32px 0 0;font-size:13px;color:#999;line-height:1.5;">
        If you didn&rsquo;t make this purchase, please contact
        <a href="mailto:support@estatevault.com" style="color:#1C3557;">support@estatevault.com</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
      <p style="margin:0 0 8px;font-size:13px;color:#1C3557;font-weight:600;">EstateVault</p>
      <p style="margin:0 0 12px;font-size:12px;color:#999;">Protect Everything That Matters</p>
      <p style="margin:0;font-size:11px;color:#bbb;line-height:1.5;">
        This platform provides document preparation services only. It does not provide legal advice.
        No attorney-client relationship is created by your use of this platform.
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#bbb;">
        &copy; 2025 EstateVault Technologies LLC
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDocumentEmail(params: SendDocumentEmailParams) {
  try {
    const packageName = params.productType === "will" ? "Will Package" : "Trust Package";

    const { error } = await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: params.to,
      subject: `Your ${packageName} is ready`,
      html: buildEmailHtml(params),
    });

    if (error) {
      console.error("Email delivery failed — documents are still saved in Supabase:", error);
    }
  } catch (emailError) {
    console.error("Email delivery failed — documents are still saved in Supabase:", emailError);
    // Do NOT re-throw — generation succeeded, client can download from their account
  }
}
