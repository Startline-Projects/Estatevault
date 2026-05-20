import { Resend } from "resend";
import { createServerClient } from "@supabase/ssr";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

const DEFAULT_FROM = "EstateVault <info@estatevault.us>";
const ESTATEVAULT_LOGO_URL =
  process.env.NEXT_PUBLIC_ESTATEVAULT_EMAIL_LOGO ||
  `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us"}/logo.png`;

export type EmailBrand = {
  companyName: string;
  logoUrl: string | null;
  isPartner: boolean;
};

function defaultBrand(): EmailBrand {
  return { companyName: "EstateVault", logoUrl: ESTATEVAULT_LOGO_URL, isPartner: false };
}

export function renderEmailHeader(brand: EmailBrand): string {
  if (brand.logoUrl) {
    return `<div style="background:#1C3557;padding:24px 32px;text-align:left;">
      <img src="${brand.logoUrl}" alt="${brand.companyName.replace(/"/g, "&quot;")}" style="max-height:40px;width:auto;display:inline-block;" />
    </div>`;
  }
  return `<div style="background:#1C3557;padding:24px 32px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${brand.companyName}</h1>
  </div>`;
}

export function renderEmailFooter(brand: EmailBrand, extra?: string): string {
  const poweredBy = brand.isPartner
    ? `<p style="margin:0 0 8px;font-size:11px;color:#bbb;">Powered by EstateVault</p>`
    : "";
  const copyright = brand.isPartner
    ? `<p style="margin:0;font-size:11px;color:#bbb;">&copy; ${new Date().getFullYear()} ${brand.companyName}</p>`
    : `<p style="margin:0;font-size:11px;color:#bbb;line-height:1.5;">&copy; ${new Date().getFullYear()} EstateVault Technologies LLC</p>`;
  return `<div style="background:#f8f9fa;padding:24px 32px;border-top:1px solid #e5e5e5;">
    ${extra || ""}
    ${poweredBy}
    ${copyright}
  </div>`;
}

function emailAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function getPartnerFrom(partnerId?: string | null): Promise<{ from: string; replyTo?: string; brand: EmailBrand }> {
  if (!partnerId) return { from: DEFAULT_FROM, brand: defaultBrand() };
  try {
    const admin = emailAdminClient();
    const { data: p } = await admin
      .from("partners")
      .select("sender_name, sender_email, email_verified, company_name, logo_url")
      .eq("id", partnerId)
      .single();
    if (p) {
      const brand: EmailBrand = {
        companyName: p.company_name || "EstateVault",
        logoUrl: p.logo_url || null,
        isPartner: true,
      };
      if (p.email_verified && p.sender_email) {
        const name = p.sender_name || p.company_name || "EstateVault";
        return { from: `${name} <${p.sender_email}>`, replyTo: p.sender_email, brand };
      }
      // partner exists but sender not verified → still brand body as partner, send from default
      return { from: DEFAULT_FROM, brand };
    }
  } catch (e) {
    console.error("getPartnerFrom failed:", e);
  }
  return { from: DEFAULT_FROM, brand: defaultBrand() };
}

/**
 * Resolves the correct {from, replyTo} for an outgoing email to a client.
 * Precedence: explicit partnerId → partnerSlug lookup → email → profile → client.partner_id.
 * Falls back to DEFAULT_FROM if no partner is identified or partner's sender is not verified.
 */
export async function resolveSenderForEmail(opts: {
  email?: string | null;
  partnerId?: string | null;
  partnerSlug?: string | null;
}): Promise<{ from: string; replyTo?: string; brand: EmailBrand }> {
  if (opts.partnerId) return getPartnerFrom(opts.partnerId);

  try {
    const admin = emailAdminClient();

    if (opts.partnerSlug) {
      const { data: partner } = await admin
        .from("partners")
        .select("id")
        .eq("partner_slug", opts.partnerSlug)
        .maybeSingle();
      if (partner?.id) return getPartnerFrom(partner.id);
    }

    if (opts.email) {
      const normalized = opts.email.trim().toLowerCase();
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", normalized)
        .maybeSingle();
      if (profile?.id) {
        const { data: client } = await admin
          .from("clients")
          .select("partner_id")
          .eq("profile_id", profile.id)
          .maybeSingle();
        if (client?.partner_id) return getPartnerFrom(client.partner_id);
      }
    }
  } catch (e) {
    console.error("resolveSenderForEmail failed:", e);
  }

  return { from: DEFAULT_FROM, brand: defaultBrand() };
}

interface SendDocumentEmailParams {
  to: string;
  productType: "will" | "trust";
  loginLink: string;
  assetChecklist?: { asset: string; instruction: string }[];
}

const ASSET_INSTRUCTIONS: Record<string, string> = {
  "Primary home / real estate in Michigan": "Transfer via Michigan Quit Claim Deed",
  "Real estate in another state": "Transfer deed in each applicable state",
  "Bank and investment accounts": "Contact your bank to retitle accounts",
  "Business interests": "See instructions for business entity retitling",
  "Vehicles": "Michigan title transfer required only for vehicles valued over $60,000",
  "Personal property and valuables": "Assignment of personal property to trust",
  "Digital assets and cryptocurrency": "See digital asset instructions",
};

export function buildAssetChecklist(assetTypes: string[]): { asset: string; instruction: string }[] {
  return assetTypes.map((asset) => ({
    asset: asset.split(" / ")[0],
    instruction: ASSET_INSTRUCTIONS[asset] || "See instructions",
  }));
}

function buildEmailHtml(
  { productType, loginLink, assetChecklist }: Omit<SendDocumentEmailParams, "to">,
  brand: EmailBrand,
): string {
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

  const disclaimer = `<p style="margin:0 0 8px;font-size:11px;color:#bbb;line-height:1.5;">
    This platform provides document preparation services only. It does not provide legal advice.
    No attorney-client relationship is created by your use of this platform.
  </p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(brand)}

    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Your ${packageName} is ready.</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your documents have been generated and are saved in your account.
        Click the button below to sign in and access your documents.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${loginLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Sign In to View Documents
        </a>
      </div>

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
    </div>

    ${renderEmailFooter(brand, disclaimer)}
  </div>
</body>
</html>`;
}

export async function sendWelcomeEmail({
  to,
  fullName,
  productType,
  loginLink,
  attorneyReview,
  partnerId,
}: {
  to: string;
  fullName?: string | null;
  productType?: "will" | "trust" | "vault" | null;
  loginLink: string;
  attorneyReview?: boolean;
  partnerId?: string | null;
}) {
  const greeting = fullName ? `Welcome, ${fullName}!` : "Welcome to EstateVault!";
  const sender = await getPartnerFrom(partnerId);

  let productLine = "";
  if (productType === "will" || productType === "trust") {
    const packageName = productType === "will" ? "Will Package" : "Trust Package";
    productLine = attorneyReview
      ? `<p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
           Your <strong>${packageName}</strong> is being prepared. Once your documents are generated, a licensed Michigan attorney will review them. We will email you the documents instantly once the attorney approves them.
         </p>`
      : `<p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
           Your <strong>${packageName}</strong> is being generated right now. We will email you as soon as your documents are ready, usually within a few minutes.
         </p>`;
  } else if (productType === "vault") {
    productLine = `<p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your EstateVault subscription is active. Sign in to start adding documents, accounts, and family contacts to your secure vault.
      </p>`;
  }

  try {
    await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to,
      subject: `Welcome to ${sender.brand.companyName}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(sender.brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">${greeting}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your account has been created. We help you protect everything that matters &mdash; documents, accounts, and the people you love.
      </p>
      ${productLine}
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Sign In to Your Account
        </a>
      </div>
    </div>
    ${renderEmailFooter(sender.brand)}
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Welcome email failed:", e);
  }
}

export async function sendAttorneyReviewPendingEmail({
  to,
  productType,
  partnerId,
}: {
  to: string;
  productType: "will" | "trust";
  partnerId?: string | null;
}) {
  const packageName = productType === "will" ? "Will Package" : "Trust Package";
  const sender = await getPartnerFrom(partnerId);
  try {
    await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to,
      subject: `Your ${packageName} is under attorney review`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(sender.brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Your ${packageName} is being reviewed.</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Your documents have been generated and submitted to a licensed Michigan attorney for review.
        Once the attorney approves them, we will email you the documents instantly so you can download and execute them.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Typical turnaround is 48 hours. No further action is required from you at this time.
      </p>
    </div>
    ${renderEmailFooter(sender.brand, `<p style="margin:0 0 8px;font-size:11px;color:#bbb;line-height:1.5;">This platform provides document preparation services only. No attorney-client relationship is created.</p>`)}
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Attorney-review-pending email failed:", e);
  }
}

export async function sendApprovalEmail({ to, productType, dashboardUrl, partnerId }: { to: string; productType: "will" | "trust"; dashboardUrl: string; partnerId?: string | null }) {
  const packageName = productType === "will" ? "Will Package" : "Trust Package";
  const sender = await getPartnerFrom(partnerId);
  try {
    await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to,
      subject: `Your ${packageName} has been reviewed and is ready`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(sender.brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Your ${packageName} is approved and ready.</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        A licensed Michigan attorney has reviewed your documents and they are now ready for download.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Download Your Documents
        </a>
      </div>
    </div>
    ${renderEmailFooter(sender.brand, `<p style="margin:0 0 8px;font-size:11px;color:#bbb;line-height:1.5;">This platform provides document preparation services only. No attorney-client relationship is created.</p>`)}
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Approval email failed:", e);
  }
}

export async function sendDocumentEmail(params: SendDocumentEmailParams & { partnerId?: string | null }) {
  try {
    const packageName = params.productType === "will" ? "Will Package" : "Trust Package";
    const sender = await getPartnerFrom(params.partnerId);

    const { error } = await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to: params.to,
      subject: `Your ${packageName} is ready`,
      html: buildEmailHtml(params, sender.brand),
    });

    if (error) {
      console.error("Email delivery failed, documents are still saved in Supabase:", error);
    }
  } catch (emailError) {
    console.error("Email delivery failed, documents are still saved in Supabase:", emailError);
    // Do NOT re-throw, generation succeeded, client can download from their account
  }
}

export async function sendAnnualReviewEmail({
  to,
  loginLink,
  partnerId,
}: {
  to: string;
  loginLink: string;
  partnerId?: string | null;
}) {
  const sender = await getPartnerFrom(partnerId);
  try {
    await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to,
      subject: "Time for your yearly estate plan check-up",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(sender.brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">A year of protection — let's keep it current.</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        It's been about a year since your estate plan was created. A quick yearly review helps make
        sure your documents still reflect your wishes and the people you trust most.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Sign in to review your plan. If everything still looks right, there's nothing more to do.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Review My Plan
        </a>
      </div>
    </div>
    ${renderEmailFooter(sender.brand, `<p style="margin:0 0 8px;font-size:11px;color:#bbb;line-height:1.5;">You're receiving this because you opted in to annual review reminders. Manage preferences in your account settings.</p>`)}
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Annual-review email failed:", e);
  }
}

export async function sendLifeEventCheckInEmail({
  to,
  loginLink,
  partnerId,
}: {
  to: string;
  loginLink: string;
  partnerId?: string | null;
}) {
  const sender = await getPartnerFrom(partnerId);
  try {
    await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to,
      subject: "Anything change in your life lately?",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    ${renderEmailHeader(sender.brand)}
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#1C3557;">Big moments are worth protecting.</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Life changes — a marriage, a new child or grandchild, a move, a new home, or a change in
        the people you'd want to look after things. When that happens, it's a good time to make sure
        your estate plan keeps up.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#2D2D2D;line-height:1.6;">
        Had a recent life event? Sign in to log it and we'll help you keep your plan in step.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginLink}" style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:600;">
          Update My Plan
        </a>
      </div>
    </div>
    ${renderEmailFooter(sender.brand, `<p style="margin:0 0 8px;font-size:11px;color:#bbb;line-height:1.5;">You're receiving this because you opted in to life event check-in reminders. Manage preferences in your account settings.</p>`)}
  </div>
</body>
</html>`,
    });
  } catch (e) {
    console.error("Life-event check-in email failed:", e);
  }
}
