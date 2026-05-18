import { NextResponse } from "next/server";
import { redeemLink } from "@/lib/auth/emailVerification";

export const dynamic = "force-dynamic";

function htmlPage(opts: {
  title: string;
  iconChar: string;
  iconKind: "ok" | "err" | "wait";
  heading: string;
  body: string;
  cta?: { label: string; formAction: string; hidden: Record<string, string> };
  hint?: string;
  status?: number;
}): Response {
  const { title, iconChar, iconKind, heading, body, cta, hint, status = 200 } = opts;
  const hiddenInputs = cta
    ? Object.entries(cta.hidden)
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`)
        .join("")
    : "";
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>EstateVault — ${title}</title>
  <style>
    body { margin:0; padding:0; background:#1C3557; font-family:'Inter','Helvetica Neue',Arial,sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:#fff; border-radius:20px; max-width:480px; width:100%; padding:40px 32px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.2); }
    .icon { width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; font-size:36px; font-weight:700; }
    .icon.ok { background:#fdf4e3; color:#C9A84C; }
    .icon.err { background:#fef2f2; color:#dc2626; }
    .icon.wait { background:#eef2ff; color:#1C3557; }
    h1 { margin:0 0 12px; color:#1C3557; font-size:24px; font-weight:700; }
    p { margin:0 0 8px; color:#525252; font-size:14px; line-height:1.6; }
    .hint { margin-top:24px; padding:16px; background:#f8f9fa; border-radius:12px; font-size:13px; color:#666; }
    .brand { margin-top:32px; font-size:13px; color:#999; font-weight:600; letter-spacing:0.05em; }
    button.cta { display:inline-block; background:#C9A84C; color:#fff; border:none; cursor:pointer; padding:14px 32px; border-radius:50px; font-size:15px; font-weight:600; margin-top:20px; font-family:inherit; }
    button.cta:hover { background:#b8973e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${iconKind}">${iconChar}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    ${cta ? `<form method="POST" action="${cta.formAction}">${hiddenInputs}<button type="submit" class="cta">${cta.label}</button></form>` : ""}
    ${hint ? `<div class="hint">${hint}</div>` : ""}
    <div class="brand">EstateVault</div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// GET: render confirmation page with "Verify Email" button. Email scanners prefetch GET only,
// which is safe here because GET does not consume the token. User must click POST button.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  if (!token || !email) {
    return htmlPage({
      title: "Verification failed",
      iconChar: "!",
      iconKind: "err",
      heading: "Verification failed",
      body: "Missing token or email. Request a new verification email.",
      status: 400,
    });
  }

  return htmlPage({
    title: "Confirm your email",
    iconChar: "&#9993;",
    iconKind: "wait",
    heading: "Confirm your email",
    body: `Click below to verify <strong>${email}</strong> and return to your original tab to continue.`,
    cta: {
      label: "Verify Email",
      formAction: "/api/auth/verify-link",
      hidden: { token, email },
    },
  });
}

// POST: redeem token (triggered by user clicking the form button — not by email scanners).
export async function POST(request: Request) {
  try {
    let token = "";
    let email = "";

    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      token = String(body.token || "");
      email = String(body.email || "");
    } else {
      const form = await request.formData();
      token = String(form.get("token") || "");
      email = String(form.get("email") || "");
    }

    if (!token || !email) {
      return htmlPage({
        title: "Verification failed",
        iconChar: "!",
        iconKind: "err",
        heading: "Verification failed",
        body: "Missing token or email. Request a new verification email.",
        status: 400,
      });
    }

    const result = redeemLink(email, token);
    if (!result.ok) {
      const msgMap = {
        expired: "This link has expired. Request a new one from the signup page.",
        invalid: "This link is invalid. Request a new one from the signup page.",
        not_requested:
          "No verification request found. Open the signup page and click Verify Email again.",
        already_used:
          "This email is already verified. Return to the original tab to continue.",
      } as const;
      return htmlPage({
        title: "Verification failed",
        iconChar: "!",
        iconKind: "err",
        heading: "Verification failed",
        body: msgMap[result.reason],
        status: 400,
      });
    }

    return htmlPage({
      title: "Email verified",
      iconChar: "&#10003;",
      iconKind: "ok",
      heading: "Email verified",
      body: "Your email has been verified.",
      hint: "Return to the original tab to continue with your order. You can close this tab.",
    });
  } catch (err) {
    console.error("verify-link POST error:", err);
    return htmlPage({
      title: "Verification failed",
      iconChar: "!",
      iconKind: "err",
      heading: "Verification failed",
      body: "Something went wrong. Try again.",
      status: 500,
    });
  }
}
