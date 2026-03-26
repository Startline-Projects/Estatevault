"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const MODULE_ID = 2;
const MODULE_TITLE = "Using the EstateVault Platform";
const MODULE_DESCRIPTION =
  "This module walks you through the complete client flow, from starting a session to document delivery. You will learn how to navigate the partner portal, manage clients, and use the vault features.";

export default function Module2Page() {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ev_training_modules");
    if (stored) {
      try {
        const modules: number[] = JSON.parse(stored);
        if (modules.includes(MODULE_ID)) setCompleted(true);
      } catch {
        // ignore
      }
    }
  }, []);

  function handleMarkComplete() {
    const stored = localStorage.getItem("ev_training_modules");
    let modules: number[] = [];
    if (stored) {
      try {
        modules = JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    if (!modules.includes(MODULE_ID)) {
      modules.push(MODULE_ID);
    }
    localStorage.setItem("ev_training_modules", JSON.stringify(modules));
    setCompleted(true);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/pro/training")}
        className="text-sm text-charcoal/50 hover:text-navy mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Training
      </button>

      <div className="rounded-xl bg-white border border-gray-200 p-8">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-charcoal/40">Module {MODULE_ID}</span>
          {completed && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Complete
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-navy">{MODULE_TITLE}</h1>
        <p className="mt-3 text-sm text-charcoal/60 leading-relaxed">{MODULE_DESCRIPTION}</p>

        <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-6 text-center">
          <span className="text-3xl">🎓</span>
          <p className="mt-3 text-sm font-semibold text-navy">Coming Soon</p>
          <p className="mt-1 text-xs text-charcoal/50">
            Full training content with video lessons and interactive exercises will be available
            in a future release.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {completed ? (
            <span className="text-sm text-green-600 font-medium">
              You have completed this module.
            </span>
          ) : (
            <button
              onClick={handleMarkComplete}
              className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold/90"
            >
              Mark as Complete
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/pro/training/module-1")}
              className="text-sm text-charcoal/50 hover:text-navy font-medium"
            >
              &larr; Previous
            </button>
            <button
              onClick={() => router.push("/pro/training/module-3")}
              className="text-sm text-navy hover:text-gold font-medium"
            >
              Next Module &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
