import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | EstateVault",
  description: "Have questions about estate planning? Contact the EstateVault team for support.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
