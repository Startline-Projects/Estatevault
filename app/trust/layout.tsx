import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Trust | EstateVault",
  description: "Build an attorney-reviewed Michigan revocable living trust in 15 minutes. Includes pour-over will, POA, and healthcare directive. $600 complete package.",
};

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return children;
}
