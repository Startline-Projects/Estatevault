"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthHandler() {
  const router = useRouter();

  useEffect(() => {
    // Check if URL hash contains an access_token (from Supabase magic/invite links)
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    async function handleAuthRedirect() {
      const supabase = createClient();

      // Supabase client automatically picks up the hash fragment
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        // Try to extract and set session manually from hash
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }

      // Clear the hash from the URL
      window.history.replaceState(null, "", window.location.pathname);

      // Check user type and redirect
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

      const userType = profile?.user_type || "client";

      if (userType === "partner") {
        router.push("/pro/dashboard");
      } else if (userType === "sales_rep" || userType === "admin") {
        router.push("/sales/dashboard");
      } else {
        router.push("/dashboard");
      }
    }

    handleAuthRedirect();
  }, [router]);

  return null;
}
