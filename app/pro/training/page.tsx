"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MODULES = [
  {
    id: 1,
    title: "Estate Planning Fundamentals",
    description: "Overview of wills, trusts, and the documents your clients will create.",
    duration: "45 min",
    href: "/pro/training/module-1",
  },
  {
    id: 2,
    title: "Using the EstateVault Platform",
    description: "Walkthrough of the client flow, document generation, and vault features.",
    duration: "60 min",
    href: "/pro/training/module-2",
  },
  {
    id: 3,
    title: "Compliance & Legal Boundaries",
    description: "What you can and cannot say to clients. Hard stop conditions and attorney referrals.",
    duration: "45 min",
    href: "/pro/training/module-3",
  },
  {
    id: 4,
    title: "Sales & Client Conversations",
    description: "How to introduce estate planning, handle objections, and convert prospects.",
    duration: "60 min",
    href: "/pro/training/module-4",
  },
];

const RESOURCES = [
  { title: "Partner Quick Start Guide", type: "PDF" },
  { title: "Client Conversation Scripts", type: "PDF" },
  { title: "Compliance Cheat Sheet", type: "PDF" },
  { title: "Marketing Toolkit Overview", type: "PDF" },
];

export default function ProTrainingPage() {
  const [certified, setCertified] = useState(false);
  const [completedModules, setCompletedModules] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("certification_completed")
        .eq("profile_id", user.id)
        .single();

      if (partner) {
        setCertified(partner.certification_completed || false);
      }

      // Load module completion from localStorage
      const stored = localStorage.getItem("ev_training_modules");
      if (stored) {
        try {
          setCompletedModules(JSON.parse(stored));
        } catch {
          // ignore parse errors
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const allModulesComplete = MODULES.every((m) => completedModules.includes(m.id));

  if (loading) {
    return (
      <div className="max-w-4xl space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Certification Training</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Complete all 4 modules and pass the exam to unlock your platform.
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
            certified
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {certified ? "Certified" : "Not Certified"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-charcoal/50 mb-2">
          <span>Progress</span>
          <span>
            {completedModules.length} of {MODULES.length} modules completed
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-gold transition-all"
            style={{
              width: `${(completedModules.length / MODULES.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Module cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod) => {
          const isComplete = completedModules.includes(mod.id);
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={`rounded-xl border-2 p-5 transition-all hover:shadow-md ${
                isComplete
                  ? "border-green-200 bg-green-50/50"
                  : "border-gray-200 bg-white hover:border-gold/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-charcoal/40">
                  Module {mod.id}
                </span>
                {isComplete ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Complete
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-charcoal/40">
                    {mod.duration}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-sm font-bold text-navy">{mod.title}</h3>
              <p className="mt-1 text-xs text-charcoal/60">{mod.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Certification exam card */}
      <div
        className={`mt-6 rounded-xl border-2 p-6 ${
          certified
            ? "border-green-200 bg-green-50/50"
            : allModulesComplete
            ? "border-gold bg-gold/5"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-navy">Certification Exam</h3>
            <p className="mt-1 text-sm text-charcoal/60">
              {certified
                ? "You have passed the certification exam."
                : allModulesComplete
                ? "All modules complete. You are ready to take the exam."
                : "Complete all 4 modules to unlock the certification exam."}
            </p>
          </div>
          {certified ? (
            <span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-700">
              Passed
            </span>
          ) : allModulesComplete ? (
            <Link
              href="/pro/training/exam"
              className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90"
            >
              Take Exam
            </Link>
          ) : (
            <span className="rounded-full bg-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-400">
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Resource library */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-navy">Resource Library</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          Downloadable guides and reference materials.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {RESOURCES.map((res) => (
            <div
              key={res.title}
              className="rounded-xl bg-white border border-gray-200 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-xs font-bold text-red-500">
                  {res.type}
                </div>
                <span className="text-sm font-medium text-navy">{res.title}</span>
              </div>
              <button disabled className="text-xs text-gray-400 cursor-not-allowed font-medium">
                Coming soon
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
