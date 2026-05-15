import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/marketing/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.admin
    .from("partners")
    .select("id, company_name, marketing_slug")
    .order("company_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ partners: data || [] });
}
