"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  full_name: string;
  phone: string;
  notification_preferences: {
    documents_delivered: boolean;
    annual_review: boolean;
    life_event_reminders: boolean;
  };
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", notification_preferences: { documents_delivered: true, annual_review: true, life_event_reminders: true } });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("account");

  // PIN change
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  // Advisor
  const [advisorName, setAdvisorName] = useState("");
  const [advisorFirm, setAdvisorFirm] = useState("");
  const [advisorConsent, setAdvisorConsent] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");

      const { data } = await supabase.from("profiles").select("full_name, phone, notification_preferences").eq("id", user.id).single();
      if (data) {
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          notification_preferences: data.notification_preferences || { documents_delivered: true, annual_review: true, life_event_reminders: true },
        });
      }

      // Load advisor info
      const { data: client } = await supabase.from("clients").select("advisor_name, advisor_firm, advisor_share_consent").eq("profile_id", user.id).single();
      if (client) {
        setAdvisorName(client.advisor_name || "");
        setAdvisorFirm(client.advisor_firm || "");
        setAdvisorConsent(client.advisor_share_consent || false);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({
      full_name: profile.full_name,
      phone: profile.phone,
      notification_preferences: profile.notification_preferences,
    }).eq("id", user.id);

    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard/settings` });
    alert("Password reset email sent. Check your inbox.");
  }

  async function changePin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { setPinMsg("PIN must be 4 digits"); return; }
    if (newPin !== confirmNewPin) { setPinMsg("PINs do not match"); return; }
    const res = await fetch("/api/vault/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change", pin: currentPin, newPin }) });
    if (!res.ok) { const d = await res.json(); setPinMsg(d.error || "Failed"); return; }
    setPinMsg("PIN changed successfully"); setCurrentPin(""); setNewPin(""); setConfirmNewPin("");
  }

  async function saveAdvisor() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("clients").update({ advisor_name: advisorName, advisor_firm: advisorFirm, advisor_share_consent: advisorConsent }).eq("profile_id", user.id);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="py-20 text-center text-charcoal/50">Loading...</div>;

  function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const isOpen = openSection === id;
    return (
      <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
        <button onClick={() => setOpenSection(isOpen ? null : id)} className="w-full flex items-center justify-between px-6 py-4 text-left">
          <span className="text-sm font-semibold text-navy">{title}</span>
          <span className="text-gold">{isOpen ? "−" : "+"}</span>
        </button>
        {isOpen && <div className="px-6 pb-6">{children}</div>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy">Settings</h1>
      {saved && <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">Saved!</div>}

      <div className="mt-6 space-y-3">
        <Section id="account" title="Account">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Full name</label>
              <input type="text" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Email</label>
              <input type="email" value={email} disabled className="w-full min-h-[44px] rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm text-charcoal/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Phone</label>
              <input type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" placeholder="(555) 555-5555" />
            </div>
            <div className="flex gap-3">
              <button onClick={saveProfile} disabled={saving} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50">Save</button>
              <button onClick={changePassword} className="rounded-full border border-navy px-6 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors">Change Password</button>
            </div>
          </div>
        </Section>

        <Section id="pin" title="Vault PIN">
          <div className="space-y-3">
            {pinMsg && <p className={`text-sm ${pinMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{pinMsg}</p>}
            <input type="password" maxLength={4} inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))} placeholder="Current PIN" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <input type="password" maxLength={4} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="New PIN" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <input type="password" maxLength={4} inputMode="numeric" value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm new PIN" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <button onClick={changePin} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90">Change PIN</button>
          </div>
        </Section>

        <Section id="notifications" title="Notifications">
          <div className="space-y-4">
            {([["documents_delivered", "Email me when my documents are delivered"], ["annual_review", "Annual review reminder"], ["life_event_reminders", "Life event check-in reminders"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-charcoal">{label}</span>
                <input type="checkbox" checked={profile.notification_preferences[key]} onChange={(e) => setProfile((p) => ({ ...p, notification_preferences: { ...p.notification_preferences, [key]: e.target.checked } }))} className="h-5 w-5 rounded accent-gold" />
              </label>
            ))}
            <button onClick={saveProfile} disabled={saving} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50">Save Preferences</button>
          </div>
        </Section>

        <Section id="advisor" title="Linked Advisor">
          <div className="space-y-4">
            <p className="text-sm text-charcoal/60">Do you work with a financial advisor or CPA?</p>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Advisor name</label>
              <input type="text" value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" placeholder="Advisor name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Firm name</label>
              <input type="text" value={advisorFirm} onChange={(e) => setAdvisorFirm(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" placeholder="Firm name" />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={advisorConsent} onChange={(e) => setAdvisorConsent(e.target.checked)} className="mt-0.5 h-5 w-5 rounded accent-gold" />
              <span className="text-sm text-charcoal">I consent to EstateVault notifying my advisor about my estate plan</span>
            </label>
            <button onClick={saveAdvisor} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90">Save</button>
          </div>
        </Section>
      </div>
    </div>
  );
}
