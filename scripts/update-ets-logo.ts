import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const res = await fetch(
    `${url}/rest/v1/partners?partner_slug=eq.www-etsfirm-com`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ logo_url: "/ets-logo.png" }),
    }
  );
  const text = await res.text();
  console.log(res.status, text);
}

main();
