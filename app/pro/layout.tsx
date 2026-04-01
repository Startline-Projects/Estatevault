import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ProShell from "@/components/pro/ProShell";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const headersList = headers();
  const url = headersList.get("x-url") || headersList.get("x-invoke-path") || headersList.get("x-matched-path") || "";

  // Onboarding and login pages render their own full-page layout — skip ProShell
  if (url.includes("/pro/onboarding") || url.includes("/pro/login")) {
    return <>{children}</>;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // No user = show raw children (login page handles itself)
  if (!user) return <>{children}</>;

  const { data: profile } = await supabase.from("profiles").select("full_name, user_type").eq("id", user.id).single();
  if (!profile) return <>{children}</>;

  // Sales reps and admins use their own layout under /pro/sales
  if (profile.user_type === "sales_rep" || profile.user_type === "admin") return <>{children}</>;

  // Only partners get the ProShell
  if (profile.user_type !== "partner") return <>{children}</>;

  const { data: partner } = await supabase.from("partners").select("company_name, tier, logo_url, onboarding_completed, certification_completed").eq("profile_id", user.id).single();
  if (!partner) return <>{children}</>;

  return (
    <ProShell
      companyName={partner.company_name || "Partner"}
      userName={profile.full_name || user.email || ""}
      tier={partner.tier || "standard"}
      logoUrl={partner.logo_url}
      onboardingComplete={partner.onboarding_completed || false}
      certificationComplete={partner.certification_completed || false}
    >
      {children}
    </ProShell>
  );
}
