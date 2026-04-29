"use client";

import { useState } from "react";

export default function AffiliateLinkCard({ link, code }: { link: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-navy/5 rounded-xl p-6 border border-navy/10">
      <label className="block text-xs font-semibold text-charcoal/60 uppercase tracking-wider mb-2">
        Your Permanent Referral Link
      </label>
      <div className="flex items-center gap-2 flex-col sm:flex-row">
        <code className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-navy font-mono break-all w-full">
          {link}
        </code>
        <button
          onClick={copy}
          className="flex-shrink-0 bg-navy hover:bg-navy/90 text-white font-semibold px-4 py-3 rounded-lg transition-colors text-sm w-full sm:w-auto"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
      <p className="mt-3 text-xs text-charcoal/60">
        Code: <span className="font-mono font-semibold text-navy">{code}</span> · 90-day cookie attribution
      </p>
    </div>
  );
}
