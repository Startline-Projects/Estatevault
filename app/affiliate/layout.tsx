import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/affiliate");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (profile?.user_type !== "affiliate") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header
        className="border-b px-6 py-4"
        style={{
          background: "linear-gradient(180deg, #fdfbf5 0%, #f7f0d9 100%)",
          borderColor: "color-mix(in srgb, #C9A84C 22%, #ffffff)",
        }}
      >
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span
              className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #1C3557 0%, #C9A84C 100%)" }}
            >
              EV
            </span>
            <div>
              <p className="text-sm font-bold text-black leading-tight">EstateVault</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-black/45">Affiliate Portal</p>
            </div>
          </Link>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60"
            style={{ border: "1px solid color-mix(in srgb, #C9A84C 22%, #ffffff)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Dashboard
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
