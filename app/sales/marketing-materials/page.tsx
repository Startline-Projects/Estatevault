"use client";

import { useEffect, useState, useCallback } from "react";
import { MARKETING_CATEGORIES, SOCIAL_PLATFORMS, categoryLabel, categoryColor, ALLOWED_MIME, MAX_FILE_BYTES } from "@/lib/marketing/categories";

type Material = {
  id: string;
  partner_slug: string | null;
  is_global: boolean;
  title: string;
  description: string | null;
  category: string;
  platform: string | null;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  sort_order: number;
  updated_at: string;
  url: string;
};

type Partner = { id: string; company_name: string; marketing_slug: string | null };

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminMarketingMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filter ? `?partnerSlug=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/admin/marketing/materials${qs}`);
    const json = await res.json();
    setMaterials(json.materials || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetch("/api/admin/marketing/partners")
      .then((r) => r.json())
      .then((j) => setPartners(j.partners || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this material permanently? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/marketing/materials/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("Delete failed"); return; }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  const [search, setSearch] = useState("");
  const filtered = materials.filter((m) =>
    !search ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    (m.description || "").toLowerCase().includes(search.toLowerCase())
  );
  const stats = {
    total: materials.length,
    global: materials.filter((m) => m.is_global).length,
    partners: new Set(materials.filter((m) => !m.is_global).map((m) => m.partner_slug)).size,
    totalSize: materials.reduce((acc, m) => acc + (m.file_size_bytes || 0), 0),
  };

  return (
    <div className="max-w-6xl">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white" style={{ background: "linear-gradient(135deg, #1C3557 0%, #0f1f37 100%)" }}>
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[#C9A84C]/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">Admin</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Marketing Materials</h1>
            <p className="mt-2 max-w-xl text-sm text-white/75 leading-relaxed">Upload, edit, or remove marketing files. Scope to one partner or mark global for all.</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-white/95 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-0.5 shrink-0"
          >
            + Upload Material
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={String(stats.total)} accent="#1C3557" />
        <StatCard label="Global" value={String(stats.global)} accent="#C9A84C" />
        <StatCard label="Partners" value={String(stats.partners)} accent="#4D714C" />
        <StatCard label="Storage" value={formatBytes(stats.totalSize)} accent="#7B3F61" />
      </div>

      {/* TOOLBAR */}
      <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter === "" ? "bg-navy text-white" : "bg-gray-100 text-charcoal/60 hover:bg-gray-200"}`}>All</button>
          <button onClick={() => setFilter("_global")} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter === "_global" ? "bg-gold text-white" : "bg-gray-100 text-charcoal/60 hover:bg-gray-200"}`}>Global</button>
          <select
            value={filter && filter !== "_global" ? filter : ""}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs"
          >
            <option value="">By partner…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.marketing_slug || ""} disabled={!p.marketing_slug}>
                {p.company_name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64 rounded-full border border-gray-200 pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-navy"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-charcoal/60">
            <tr>
              <th className="px-4 py-3 text-left">Preview</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Target</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Size</th>
              <th className="px-4 py-3 text-left">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-t border-gray-100">
                <td className="px-4 py-3"><div className="h-12 w-12 bg-gray-100 rounded-lg animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-32 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-12 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse ml-auto" /></td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" className="mx-auto mb-3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                </svg>
                <p className="text-sm text-charcoal/60 font-medium">No materials found</p>
                <p className="text-xs text-charcoal/40 mt-1">Try adjusting filters or upload your first file.</p>
              </td></tr>
            )}
            {!loading && filtered.map((m) => (
              <tr key={m.id} className={`border-t border-gray-100 hover:bg-gray-50/50 transition-all ${deletingId === m.id ? "opacity-40 pointer-events-none" : ""}`}>
                <td className="px-4 py-3">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="block h-12 w-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 relative hover:ring-2 hover:ring-navy/30 transition-all">
                    {m.mime_type?.startsWith("image/")
                      ? <img src={m.url} alt={m.title} className="absolute inset-0 w-full h-full object-cover" />
                      : <iframe src={`${m.url}#toolbar=0&navpanes=0&view=FitH`} className="absolute inset-0 w-full h-full pointer-events-none" title={m.title} />}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy hover:underline">{m.title}</a>
                  {m.description && <p className="text-xs text-charcoal/50 mt-0.5 line-clamp-1">{m.description}</p>}
                </td>
                <td className="px-4 py-3">
                  {m.is_global
                    ? <span className="inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">Global</span>
                    : <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-charcoal/70">{m.partner_slug}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white" style={{ background: categoryColor(m.category) }}>
                    {categoryLabel(m.category)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-charcoal/60">{formatBytes(m.file_size_bytes)}</td>
                <td className="px-4 py-3 text-xs text-charcoal/60">{new Date(m.updated_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(m)} disabled={deletingId === m.id} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-charcoal/70 hover:bg-gray-50 disabled:opacity-50">Edit</button>
                  <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id} className="ml-2 inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed">
                    {deletingId === m.id ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Deleting…
                      </>
                    ) : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <MaterialModal
          partners={partners}
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); load(); }}
        />
      )}
      {editing && (
        <MaterialModal
          partners={partners}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

function MaterialModal({
  partners,
  existing,
  onClose,
  onSaved,
}: {
  partners: Partner[];
  existing?: Material;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [category, setCategory] = useState(existing?.category || "print");
  const [platform, setPlatform] = useState(existing?.platform || "linkedin");
  const [sortOrder, setSortOrder] = useState(existing?.sort_order ?? 0);
  const [isGlobal, setIsGlobal] = useState(existing?.is_global || false);
  const [partnerSlug, setPartnerSlug] = useState(existing?.partner_slug || "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slugOptions = partners.filter((p) => p.marketing_slug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title required"); return; }
    if (!isGlobal && !partnerSlug) { setError("Pick a partner or mark global"); return; }
    if (!existing && !file) { setError("File required"); return; }
    if (file && !ALLOWED_MIME.includes(file.type)) { setError("Only PDF/PNG/JPG"); return; }
    if (file && file.size > MAX_FILE_BYTES) { setError("Max 25MB"); return; }

    setSaving(true);
    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append("category", category);
    if (category === "social") form.append("platform", platform);
    else form.append("platform", "");
    form.append("sortOrder", String(sortOrder));
    form.append("isGlobal", String(isGlobal));
    if (!isGlobal) form.append("partnerSlug", partnerSlug);
    if (file) form.append("file", file);

    const url = existing ? `/api/admin/marketing/materials/${existing.id}` : "/api/admin/marketing/materials";
    const method = existing ? "PATCH" : "POST";
    const res = await fetch(url, { method, body: form });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Save failed");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-navy">{existing ? "Edit Material" : "Upload Material"}</h2>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
            <span>Global (visible to all partners)</span>
          </label>

          {!isGlobal && (
            <div>
              <label className="text-xs font-semibold text-charcoal/70">Partner</label>
              <select value={partnerSlug} onChange={(e) => setPartnerSlug(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">— Select —</option>
                {slugOptions.map((p) => (
                  <option key={p.id} value={p.marketing_slug!}>{p.company_name} ({p.marketing_slug})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-charcoal/70">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-charcoal/70">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-charcoal/70">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                {MARKETING_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-charcoal/70">Sort order</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
          </div>

          {category === "social" && (
            <div>
              <label className="text-xs font-semibold text-charcoal/70">Social Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-charcoal/70">
              {existing ? "Replace file (optional)" : "File"}
            </label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm" />
            <p className="mt-1 text-xs text-charcoal/50">PDF, PNG, JPG. Max 25MB.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-charcoal/70 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50">
            {saving ? "Saving…" : existing ? "Save changes" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
