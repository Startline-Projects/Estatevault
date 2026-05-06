"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Step7Page() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: partner } = await supabase.from("partners").select("id, company_name").eq("profile_id", user.id).single();
      if (partner) { setPartnerId(partner.id); setCompanyName(partner.company_name || ""); }
    }
    load();
  }, []);

  async function handleGoToDashboard() {
    const supabase = createClient();
    await supabase.from("partners").update({ onboarding_completed: true, onboarding_step: 7, status: "active" }).eq("id", partnerId);
    window.location.href = "/pro/dashboard";
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    const supabase = createClient();
    await supabase.from("waitlist_invites").insert({ partner_id: partnerId, client_email: inviteEmail });
    setInviteSent(true);
    setInviteEmail("");
    setInviting(false);
    setTimeout(() => setInviteSent(false), 3000);
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/40">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy">
          You&apos;re all set{companyName ? `, ${companyName}` : ""}.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-charcoal/60">
          Your EstateVault Pro platform is being configured. We&apos;ll send your launch email within 3 business days.
        </p>

        {/* Progress bar */}
        <div className="mx-auto mt-6 max-w-md">
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-green-500" style={{ width: "100%" }} />
          </div>
          <p className="mt-2 text-xs font-medium text-charcoal/50">All 7 steps complete</p>
        </div>
      </div>

      {/* Compliance */}
      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-navy">Compliance Readiness</h3>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">2 of 3</span>
        </div>
        <ul className="mt-4 divide-y divide-gray-100">
          <ChecklistItem done label="Partner Agreement Signed" />
          <ChecklistItem done={false} label="Certification Training" hint="Required to unlock client features" />
          <ChecklistItem done label="Pricing Acknowledged" />
        </ul>
        <p className="mt-4 text-xs text-charcoal/50">
          You can explore your dashboard now, but client sessions are locked until certification is complete.
        </p>
      </div>

      {/* Action cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionCard
          accent="gold"
          icon={<GradCapIcon />}
          title="Complete Certification"
          desc="4 modules + exam, ~4.5 hours. Unlocks full platform on passing."
          action={
            <Link href="/pro/training" className="inline-flex items-center justify-center rounded-full bg-gold px-4 py-2 text-xs font-semibold text-white hover:bg-gold/90 transition-colors">
              Start Training →
            </Link>
          }
        />
        <ActionCard
          accent="navy"
          icon={<BoxIcon />}
          title="Marketing Toolkit"
          desc="Scripts, email templates, social posts, print materials — all branded for you."
          action={
            <button disabled className="inline-flex items-center justify-center rounded-full bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-400 cursor-not-allowed">
              Locked
            </button>
          }
        />
        <ActionCard
          accent="teal"
          icon={<UserIcon />}
          title="Invite First Client"
          desc="Add a client now so they're ready when your platform goes live."
          action={
            <div className="flex w-full items-center gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="client@email.com"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="shrink-0 rounded-full bg-teal-500 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600 disabled:bg-gray-200 disabled:text-gray-400"
              >
                {inviteSent ? "Sent ✓" : "Invite"}
              </button>
            </div>
          }
        />
      </div>

      {/* Dashboard preview */}
      <div className="mt-10">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy">Your dashboard is ready</h3>
        <div className="relative overflow-hidden rounded-2xl border border-gray-200">
          <div className="opacity-40">
            <div className="flex h-12 items-center bg-navy px-4">
              <span className="text-sm font-bold text-white">EstateVault Pro</span>
            </div>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-6">
              <div className="h-24 rounded-lg bg-white" />
              <div className="h-24 rounded-lg bg-white" />
              <div className="h-24 rounded-lg bg-white" />
              <div className="col-span-2 h-32 rounded-lg bg-white" />
              <div className="h-32 rounded-lg bg-white" />
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-charcoal/70 shadow-md ring-1 ring-gray-200">
              <LockIcon />
              Full access unlocks at platform launch + certification
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-10 flex justify-center">
        <button
          onClick={handleGoToDashboard}
          className="inline-flex min-h-[44px] items-center rounded-full bg-gold px-10 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-gold/90 transition-colors"
        >
          Go to My Dashboard →
        </button>
      </div>
    </div>
  );
}

function ChecklistItem({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-green-500" : "border border-gray-300 bg-white"}`}>
        {done && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? "text-charcoal" : "text-charcoal/70"}`}>{label}</p>
        {hint && <p className="mt-0.5 text-xs text-gold">{hint}</p>}
      </div>
    </li>
  );
}

function ActionCard({
  accent,
  icon,
  title,
  desc,
  action,
}: {
  accent: "gold" | "navy" | "teal";
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  const accentBg = { gold: "bg-gold/10 text-gold", navy: "bg-navy/10 text-navy", teal: "bg-teal-50 text-teal-600" }[accent];
  const accentBar = { gold: "bg-gold", navy: "bg-navy", teal: "bg-teal-500" }[accent];
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5">
      <span className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} />
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentBg}`}>{icon}</div>
      <h4 className="mt-3 text-sm font-bold text-navy">{title}</h4>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-charcoal/60">{desc}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function GradCapIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v7M5 10v6c0 1 3 3 7 3s7-2 7-3v-6" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a4 4 0 118 0m-12 4h12a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6a2 2 0 012-2z" />
    </svg>
  );
}
