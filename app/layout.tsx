import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthHandler from "@/components/AuthHandler";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EstateVault — Protect Everything That Matters",
  description:
    "Attorney-reviewed wills and trusts built for Michigan. Secure estate planning with a complete family vault. Takes just 15 minutes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthHandler />
        {children}
      </body>
    </html>
  );
}
