import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import AuthHandler from "@/components/AuthHandler";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className={inter.className}>
        <AuthHandler />
        {children}
      </body>
    </html>
  );
}
