"use client";

import { useRouter } from "next/navigation";
import VaultTrusteesView from "@/components/vault/VaultTrusteesView";

// Thin route wrapper so /dashboard/vault/trustees still deep-links. In-app the
// trustees view is rendered as an internal vault screen (no remount).
export default function TrusteesPage() {
  const router = useRouter();
  return <VaultTrusteesView onBack={() => router.push("/dashboard/vault")} />;
}
