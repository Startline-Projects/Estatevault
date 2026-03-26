"use client";

import { useEffect } from "react";

interface ProcessingScreenProps {
  onComplete: () => void;
}

export default function ProcessingScreen({ onComplete }: ProcessingScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy px-6">
      {/* Pulsing shield */}
      <div className="animate-pulse">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gold/20">
          <span className="text-5xl text-gold">🛡</span>
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-bold text-white">
        Reviewing your answers...
      </h2>
      <p className="mt-3 text-sm text-blue-100/60">
        Building your personalized recommendation
      </p>

      {/* Progress dots */}
      <div className="mt-10 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-gold"
            style={{
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
