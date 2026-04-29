"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Creds {
  clientName: string;
  clientEmail: string;
  tempPassword: string;
  pin: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const isSetup = searchParams.get("setup") === "1";
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isSetup) return;
    try {
      const raw = sessionStorage.getItem("vault_client_creds");
      if (raw) {
        setCreds(JSON.parse(raw));
        sessionStorage.removeItem("vault_client_creds");
      }
    } catch {
      // sessionStorage unavailable or parse error
    }
  }, [isSetup]);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-navy">Vault Created!</h1>
        <p className="mt-2 text-sm text-charcoal/60">
          Payment successful. Share the credentials below with{" "}
          <span className="font-semibold text-navy">{creds?.clientName || "your client"}</span> so they can log in.
        </p>
      </div>

      {creds ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Share these with your client</p>
            <p className="mt-0.5 text-xs text-amber-700">They'll use the email + password to log in, then the PIN to access their vault.</p>
          </div>

          <CredRow label="Client Email" value={creds.clientEmail} copied={copied} onCopy={copyText} copyKey="email" />
          <CredRow label="Temporary Password" value={creds.tempPassword} copied={copied} onCopy={copyText} copyKey="password" />
          <CredRow label="Vault PIN" value={creds.pin} copied={copied} onCopy={copyText} copyKey="pin" />

          <div className="rounded-xl bg-navy/5 px-4 py-3">
            <p className="text-xs text-charcoal/60">Your client can change their password and PIN after logging in for the first time.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-charcoal/60">Vault created successfully. The client can log in with the credentials you set.</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link href="/pro/vault-clients/new" className="flex-1 rounded-full border border-gray-300 py-2.5 text-center text-sm font-medium text-charcoal hover:bg-gray-50">
          + Add Another
        </Link>
        <Link href="/pro/vault-clients" className="flex-1 rounded-full bg-gold py-2.5 text-center text-sm font-semibold text-white hover:bg-gold/90">
          View All Clients →
        </Link>
      </div>
    </div>
  );
}

function CredRow({ label, value, copied, onCopy, copyKey }: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  copyKey: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-charcoal/50">{label}</p>
        <p className="mt-0.5 text-sm font-mono font-semibold text-navy break-all">{value}</p>
      </div>
      <button
        onClick={() => onCopy(value, copyKey)}
        className="ml-3 shrink-0 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-charcoal/70 hover:text-navy hover:border-navy transition-colors"
      >
        {copied === copyKey ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function VaultClientSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
