import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Will | EstateVault",
  description: "Build an attorney-reviewed Michigan will in 15 minutes. Includes power of attorney and healthcare directive. $400 complete package.",
};

export default function WillLayout({ children }: { children: React.ReactNode }) {
  return children;
}
