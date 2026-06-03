"use client";

import { useState, useEffect } from "react";
import { recovery } from "@/lib/api-client/auth";
import { pinAction } from "@/lib/api-client/vault";
import { getClientSettings, updateClientProfile, updateClientAdvisor } from "@/lib/api-client/clientAccount";
import LoadingScreen from "@/components/ui/LoadingScreen";

interface Profile {
  full_name: string;
  phone: string;
  notification_preferences: {
    documents_delivered: boolean;
    annual_review: boolean;
    life_event_reminders: boolean;
  };
}

function Section({ id, title, openSection, setOpenSection, children }: { id: string; title: string; openSection: string | null; setOpenSection: (v: string | null) => void; children: React.ReactNode }) {
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

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", notification_preferences: { documents_delivered: true, annual_review: true, life_event_reminders: true } });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("account");

  // PIN change
  const [hasPin, setHasPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Advisor
  const [advisorName, setAdvisorName] = useState("");
  const [advisorFirm, setAdvisorFirm] = useState("");
  const [advisorConsent, setAdvisorConsent] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await getClientSettings();
      if (data?.profile) {
        setEmail(data.profile.email || "");
        setProfile({
          full_name: data.profile.full_name || "",
          phone: data.profile.phone || "",
          notification_preferences: (data.profile.notification_preferences as { documents_delivered: boolean; annual_review: boolean; life_event_reminders: boolean } | null) || { documents_delivered: true, annual_review: true, life_event_reminders: true },
        });
      }

      // Check PIN status
      try {
        const { data: pinData } = await pinAction({ action: "check" });
        if (pinData && "selfSet" in pinData) {
          setHasPin(!!pinData.selfSet);
        }
      } catch {}

      if (data?.advisor) {
        setAdvisorName(data.advisor.advisor_name || "");
        setAdvisorFirm(data.advisor.advisor_firm || "");
        setAdvisorConsent(data.advisor.advisor_share_consent || false);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    await updateClientProfile({
      full_name: profile.full_name,
      phone: profile.phone,
      notification_preferences: profile.notification_preferences,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    setPwSaving(true);
    await recovery(email);
    setPwSaving(false);
    alert("Password reset email sent. Check your inbox.");
  }

  async function changePin() {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) { setPinMsg("PIN must be 6 digits"); return; }
    if (newPin !== confirmNewPin) { setPinMsg("PINs do not match"); return; }
    setPinSaving(true);
    const { error: pinErr } = await pinAction({ action: "change", pin: currentPin, newPin });
    setPinSaving(false);
    if (pinErr) { setPinMsg(pinErr); return; }
    setPinMsg("PIN changed successfully"); setCurrentPin(""); setNewPin(""); setConfirmNewPin("");
  }

  async function saveAdvisor() {
    await updateClientAdvisor({ advisor_name: advisorName, advisor_firm: advisorFirm, advisor_share_consent: advisorConsent });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <LoadingScreen message="Loading your settings…" />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy">Settings</h1>
      {saved && <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">Saved!</div>}

      <div className="mt-6 space-y-3">
        <Section id="account" title="Account" openSection={openSection} setOpenSection={setOpenSection}>
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
              <button onClick={changePassword} disabled={pwSaving} className="rounded-full border border-navy px-6 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{pwSaving ? "Sending…" : "Change Password"}</button>
            </div>
          </div>
        </Section>

        {hasPin && (
          <Section id="pin" title="Vault PIN" openSection={openSection} setOpenSection={setOpenSection}>
            <div className="space-y-3">
              {pinMsg && <p id="pin-change-msg" role="alert" className={`text-sm ${pinMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{pinMsg}</p>}
              <input type="password" maxLength={6} inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))} placeholder="Current PIN" aria-label="Current PIN" aria-invalid={!!pinMsg && !pinMsg.includes("success")} aria-describedby={pinMsg ? "pin-change-msg" : undefined} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <input type="password" maxLength={6} inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="New PIN" aria-label="New PIN" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <input type="password" maxLength={6} inputMode="numeric" value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm new PIN" aria-label="Confirm new PIN" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <button onClick={changePin} disabled={pinSaving} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">{pinSaving ? "Changing…" : "Change PIN"}</button>
            </div>
          </Section>
        )}

        <Section id="notifications" title="Notifications" openSection={openSection} setOpenSection={setOpenSection}>
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

        <Section id="advisor" title="Linked Advisor" openSection={openSection} setOpenSection={setOpenSection}>
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
