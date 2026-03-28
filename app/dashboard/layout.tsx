import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PasswordChangeBanner from "@/components/dashboard/PasswordChangeBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, requires_password_change")
    .eq("id", user.id)
    .single();

  const name = profile?.full_name || profile?.email || user.email || "Client";
  const requiresPasswordChange = profile?.requires_password_change === true;

  return (
    <DashboardShell userName={name}>
      {requiresPasswordChange && <PasswordChangeBanner />}
      {children}
    </DashboardShell>
  );
}
