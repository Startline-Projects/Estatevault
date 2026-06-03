"use client";

import { useRouter } from "next/navigation";
import VaultFarewellView from "@/components/vault/VaultFarewellView";

// Thin route wrapper so /dashboard/vault/farewell still deep-links. In-app the
// farewell view is rendered as an internal vault screen (no remount).
export default function FarewellMessagesPage() {
  const router = useRouter();
  return <VaultFarewellView onBack={() => router.push("/dashboard/vault")} />;
}
