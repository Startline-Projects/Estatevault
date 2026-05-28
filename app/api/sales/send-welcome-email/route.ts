import { NextRequest } from "next/server";
import { Resend } from "resend";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesSendWelcomeEmailSchema } from "@/lib/validation/schemas";
import { partnerUrl } from "@/lib/hosts";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = salesSendWelcomeEmailSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email, tempPassword, ownerName, companyName } = parsed.data;

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const sent = await resend.emails.send({
    from: "EstateVault <info@estatevault.us>",
    to: email,
    subject: "Welcome to EstateVault, Your Partner Account",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #1C3557; font-size: 24px;">Welcome to EstateVault</h1>
        <p style="color: #2D2D2D; line-height: 1.6;">Hi ${ownerName || "there"},</p>
        <p style="color: #2D2D2D; line-height: 1.6;">
          Your partner account${companyName ? ` for <strong>${companyName}</strong>` : ""} has been created.
          Use the credentials below to sign in and complete your onboarding:
        </p>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Email</p>
          <p style="margin: 0 0 16px 0; color: #1C3557; font-weight: 600;">${email}</p>
          <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Temporary Password</p>
          <p style="margin: 0; color: #1C3557; font-weight: 600; font-family: monospace; font-size: 18px;">${tempPassword}</p>
        </div>
        <a href="${partnerUrl("/auth/login")}"
           style="display: block; text-align: center; background: #C9A84C; color: white; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-weight: 600; font-size: 14px;">
          Sign In to Your Partner Account
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
          Please change your password after signing in.
        </p>
      </div>
    `,
  });
  if (sent.error) return fail("Failed to send email", 500);

  return ok({ success: true });
});
