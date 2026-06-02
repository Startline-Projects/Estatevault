import { NextRequest } from "next/server";
import { getResend } from "@/lib/email";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesCreateRepSchema } from "@/lib/validation/schemas";
import { generateTempPassword } from "@/lib/utils/generate-password";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["admin"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = salesCreateRepSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { fullName, email, commissionRate } = parsed.data;
  const rateDecimal = commissionRate / 100;

  const tempPassword = generateTempPassword();

  const { data: newUser, error: createErr } = await auth.admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, user_type: "sales_rep" },
  });
  if (createErr || !newUser.user) return fail("Failed to create user", 500);

  await profileRepo.upsert(auth.admin, {
    id: newUser.user.id,
    email,
    full_name: fullName,
    user_type: "sales_rep",
    commission_rate: rateDecimal,
  });

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "sales_rep.created",
    resource_type: "profile",
    resource_id: newUser.user.id,
    metadata: { email, full_name: fullName },
  });

  try {
    const resend = getResend();
    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: email,
      subject: "Welcome to EstateVault, Your Sales Account",
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #1C3557; font-size: 24px;">Welcome to EstateVault</h1>
          <p style="color: #2D2D2D; line-height: 1.6;">Hi ${fullName},</p>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Your sales account has been created. Use the credentials below to sign in:
          </p>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Email</p>
            <p style="margin: 0 0 16px 0; color: #1C3557; font-weight: 600;">${email}</p>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Temporary Password</p>
            <p style="margin: 0; color: #1C3557; font-weight: 600; font-family: monospace; font-size: 18px;">${tempPassword}</p>
          </div>
          <a href="https://www.estatevault.us/auth/login"
             style="display: block; text-align: center; background: #C9A84C; color: white; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-weight: 600; font-size: 14px;">
            Sign In to Your Account
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
            Please change your password after signing in.
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error("Welcome email failed:", emailErr);
  }

  return ok({ success: true, userId: newUser.user.id, email });
});
