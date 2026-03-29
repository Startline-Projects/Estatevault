"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only process if URL hash contains auth tokens
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    const supabase = createClient();

    // Listen for auth state change — Supabase client auto-detects hash tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Clear the hash from URL
          window.history.replaceState(null, "", pathname);

          // Get user type to redirect to correct dashboard
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", session.user.id)
            .single();

          const userType = profile?.user_type || "client";

          if (userType === "partner") {
            router.push("/pro/dashboard");
          } else if (userType === "sales_rep" || userType === "admin") {
            router.push("/sales/dashboard");
          } else {
            router.push("/dashboard");
          }

          subscription.unsubscribe();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  return null;
}
