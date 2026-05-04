import { createClient } from "@supabase/supabase-js";
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let allUsers: any[] = [];
  for (let page = 1; page < 10; page++) {
    const { data: u } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (!u.users.length) break;
    allUsers = allUsers.concat(u.users);
    if (u.users.length < 1000) break;
  }
  const user = allUsers.find(x => x.email === "lite@gmail.com");
  console.log("user:", user?.id, "total:", allUsers.length);
  const { data: all } = await sb.from("partners").select("id,partner_slug,tier,company_name,sender_email,created_by");
  console.log(JSON.stringify(all, null, 2));
}
main();
