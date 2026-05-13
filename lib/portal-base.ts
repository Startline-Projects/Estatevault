"use client";

import { usePathname } from "next/navigation";

export function usePortalBase(): "/sales" | "/attorney" {
  const pathname = usePathname() || "";
  return pathname.startsWith("/attorney") ? "/attorney" : "/sales";
}
