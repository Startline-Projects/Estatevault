"use client";

import { createContext, useContext } from "react";

export const PartnerAccentContext = createContext<{ accent: string; accentDark: string }>({
  accent: "#C9A84C",
  accentDark: "#9a7f37",
});

export function usePartnerAccent() {
  return useContext(PartnerAccentContext);
}
