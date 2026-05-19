"use client";

import Link from "next/link";

export default function AdminToolsPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-navy">Admin Tools</h1>
      <p className="mt-1 text-sm text-charcoal/60">Platform administration tools.</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/pro/sales/admin/regenerate-docs"
          className="block rounded-xl bg-white border border-gray-200 p-6 hover:border-gold hover:shadow-md transition"
        >
          <span className="text-2xl">🛠</span>
          <h3 className="mt-3 text-sm font-bold text-navy">Regenerate Missing Documents</h3>
          <p className="mt-1 text-xs text-charcoal/50">
            Find orders with failed PDF uploads and retry only the missing document types.
          </p>
          <span className="mt-3 inline-block rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs text-green-700">
            Active
          </span>
        </Link>
        {[
          { icon: "👥", title: "All Partners", desc: "View and manage all partner accounts across all reps" },
          { icon: "📊", title: "Platform Analytics", desc: "Revenue, document volume, and growth metrics" },
          { icon: "📋", title: "Template Management", desc: "Manage document templates and versions" },
          { icon: "⚖", title: "Attorney Network", desc: "Manage reviewing attorneys and assignments" },
        ].map((t) => (
          <div key={t.title} className="rounded-xl bg-white border border-gray-200 p-6 opacity-60">
            <span className="text-2xl">{t.icon}</span>
            <h3 className="mt-3 text-sm font-bold text-navy">{t.title}</h3>
            <p className="mt-1 text-xs text-charcoal/50">{t.desc}</p>
            <span className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-charcoal/60">Coming Soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
