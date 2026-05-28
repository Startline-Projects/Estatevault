"use client";

import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-navy mb-2">Something went wrong</h2>
      <p className="text-sm text-charcoal/60 mb-6 max-w-sm">Your information is safe. Please try again or return to your dashboard.</p>
      {process.env.NODE_ENV === "development" && error.message && (
        <pre className="mb-4 p-3 rounded-lg bg-gray-50 border text-xs text-charcoal/60 max-w-md overflow-auto">{error.message}</pre>
      )}
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">Try Again</button>
        <Link href="/dashboard" className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gray-50 transition-colors">Back to Dashboard</Link>
      </div>
    </div>
  );
}
