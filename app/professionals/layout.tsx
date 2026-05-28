import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Professionals | EstateVault",
  description: "Partner with EstateVault to offer estate planning to your clients. Earn revenue on every plan. White-label portal included.",
};

export default function ProfessionalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
