"use client";

import Link from "next/link";
import { useState } from "react";
import type { QuizAnswers, Recommendation } from "@/lib/quiz-types";
import YesNoTiles from "./YesNoTiles";

interface ResultScreenProps {
  recommendation: Recommendation;
  answers: QuizAnswers;
  onUpdateAnswers: (updates: Partial<QuizAnswers>) => void;
}

const willBullets = [
  "Covers your estate at your current asset level",
  "Names your executor and beneficiaries",
  "Includes Power of Attorney and Healthcare Directive",
];

const trustBullets = [
  "Avoids Michigan probate \u2014 keeps your affairs private",
  "Protects your home and assets for your family",
  "Includes all 4 documents your family needs",
];

const willFeatures = [
  "Last Will & Testament",
  "Durable Power of Attorney",
  "Healthcare Directive",
  "Execution Guide",
  "Family Vault Access",
];

const trustFeatures = [
  "Revocable Living Trust",
  "Pour-Over Will",
  "Durable Power of Attorney",
  "Healthcare Directive",
  "Asset Funding Checklist",
  "Family Vault Access",
  "Attorney Review Available",
];

export default function ResultScreen({
  recommendation,
  answers,
  onUpdateAnswers,
}: ResultScreenProps) {
  const isWill = recommendation === "will";
  const headline = isWill
    ? "A Will Package is the right fit for your situation."
    : "A Trust Package is the right fit for your situation.";
  const bullets = isWill ? willBullets : trustBullets;
  const price = isWill ? "$400" : "$600";
  const features = isWill ? willFeatures : trustFeatures;
  const href = isWill ? "/will?recommendation=will" : "/trust?recommendation=trust";
  const [showAdvisorFollow, setShowAdvisorFollow] = useState(false);

  return (
    <div className="min-h-screen bg-navy px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Result heading */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20">
            <span className="text-3xl">✓</span>
          </div>
          <p className="mt-3 text-sm font-medium uppercase tracking-wider text-gold">
            Based on your answers
          </p>
          <h1 className="mt-4 text-2xl md:text-3xl font-bold text-white leading-snug">
            {headline}
          </h1>
        </div>

        {/* Bullets */}
        <ul className="mt-8 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-blue-100/80 text-sm">
              <span className="mt-0.5 text-gold">&#10003;</span>
              {b}
            </li>
          ))}
        </ul>

        {/* Package card */}
        <div className="mt-10 rounded-2xl bg-white p-8 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-navy">
              {isWill ? "Will Package" : "Trust Package"}
            </h3>
            {!isWill && (
              <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                Most Popular
              </span>
            )}
          </div>
          <p className="mt-1 text-3xl font-bold text-navy">{price}</p>

          <ul className="mt-6 space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-charcoal/80">
                <span className="mt-0.5 text-gold font-bold">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          <Link
            href={href}
            className="mt-8 block w-full min-h-[44px] rounded-full bg-gold py-3.5 text-center text-sm font-semibold text-white hover:bg-gold/90 transition-colors"
          >
            Get Started — {price}
          </Link>

          <Link
            href={href}
            className="mt-3 block text-center text-sm text-navy/60 underline hover:text-navy transition-colors"
          >
            Learn more about what&apos;s included
          </Link>
        </div>

        {/* Advisor section */}
        <div className="mt-10 rounded-2xl bg-white/5 border border-white/10 p-6">
          <p className="text-sm font-semibold text-white">
            Do you work with a financial advisor or CPA?
          </p>
          <div className="mt-3">
            <YesNoTiles
              value={answers.worksWithAdvisor}
              onChange={(val) => {
                onUpdateAnswers({ worksWithAdvisor: val });
                setShowAdvisorFollow(val === "Yes");
                if (val === "No") {
                  onUpdateAnswers({ worksWithAdvisor: val, shareWithAdvisor: false });
                }
              }}
            />
          </div>

          {showAdvisorFollow && (
            <div className="mt-5">
              <p className="text-sm font-medium text-white">
                Would you like them to know about your estate plan?
              </p>
              <label className="mt-3 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={answers.shareWithAdvisor}
                  onChange={(e) =>
                    onUpdateAnswers({ shareWithAdvisor: e.target.checked })
                  }
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-gold accent-gold"
                />
                <span className="text-sm text-blue-100/80">
                  Yes, I&apos;d like to share this with my advisor
                </span>
              </label>
              <p className="mt-2 text-xs text-blue-100/40">
                We&apos;ll ask for their name and firm — your explicit opt-in only
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
