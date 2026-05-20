/// <reference types="node" />
/**
 * Manual test: sends each notification email to a test inbox via the real
 * sender functions (default EstateVault branding, no partner).
 * Run: npx tsx -r dotenv/config scripts/test-reminder-emails.ts dotenv_config_path=.env.local
 */
import {
  sendAnnualReviewEmail,
  sendLifeEventCheckInEmail,
  sendDocumentEmail,
} from "../lib/email";

const TO = process.argv[2] || "yamir4266@gmail.com";
const NAME = process.argv[3] || "Jordan Smith";
const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
const loginLink = `${base}/auth/login?email=${encodeURIComponent(TO)}`;
// Sample delivered date ~1 year ago for personalization preview.
const deliveredAt = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Sending test emails to: ${TO} (name: ${NAME})`);
  console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "present" : "MISSING"}`);

  console.log("1/3 annual review…");
  await sendAnnualReviewEmail({ to: TO, loginLink, clientName: NAME, deliveredAt });
  await sleep(700);

  console.log("2/3 life-event check-in…");
  await sendLifeEventCheckInEmail({ to: TO, loginLink, clientName: NAME, deliveredAt });
  await sleep(700);

  console.log("3/3 documents delivered…");
  await sendDocumentEmail({ to: TO, productType: "will", loginLink });

  console.log("Done. Check inbox (and spam). Any 'failed' lines above = a send error.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
