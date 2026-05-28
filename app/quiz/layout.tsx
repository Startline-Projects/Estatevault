import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estate Planning Quiz | EstateVault",
  description: "Answer a few questions to find out if you need a will or trust. Free, takes 5 minutes. Michigan-specific estate planning guidance.",
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
