'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Khan Law Group palette ───────────────────────────────────────────────────
const NAVY = '#3f2d18';
const NAVY_800 = '#2d2018';
const GOLD = '#efba81';
const GOLD_600 = '#ba8b57';
const SURFACE = '#faf5ee';
const LINE = '#ece4d7';
const CHARCOAL = '#2d2926';

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_NAME = 'Sarah Thompson';
const DEMO_FIRST = 'Sarah';
const PACKAGE = 'Trust Package';
const DOCS = [
  { id: 1, name: 'Revocable Living Trust', pages: 32, size: '248 KB', status: 'Ready' },
  { id: 2, name: 'Pour-Over Will', pages: 8, size: '62 KB', status: 'Ready' },
  { id: 3, name: 'Durable Power of Attorney', pages: 6, size: '48 KB', status: 'Ready' },
  { id: 4, name: 'Patient Advocate Designation', pages: 4, size: '36 KB', status: 'Ready' },
];
const VAULT_CATEGORIES = [
  { id: 'docs', name: 'Estate Documents', icon: '📄', count: 4 },
  { id: 'finance', name: 'Financial Accounts', icon: '💳', count: 0 },
  { id: 'insurance', name: 'Insurance Policies', icon: '🛡️', count: 0 },
  { id: 'digital', name: 'Digital Accounts', icon: '🔑', count: 0 },
  { id: 'locations', name: 'Physical Locations', icon: '📍', count: 0 },
  { id: 'contacts', name: 'Important Contacts', icon: '👤', count: 0 },
  { id: 'business', name: 'Business Interests', icon: '🏢', count: 0 },
  { id: 'wishes', name: 'Final Wishes', icon: '💛', count: 0 },
];
const LIFE_EVENTS = [
  { id: 1, label: 'Marriage or divorce', icon: '💍' },
  { id: 2, label: 'New child or grandchild', icon: '👶' },
  { id: 3, label: 'Death of a beneficiary', icon: '🕊️' },
  { id: 4, label: 'Major asset purchase', icon: '🏠' },
  { id: 5, label: 'Retirement', icon: '🌅' },
  { id: 6, label: 'Business change', icon: '📊' },
];

type NavSection = 'home' | 'documents' | 'vault' | 'life-events' | 'settings';

// ─── Sub-components ───────────────────────────────────────────────────────────
function CompletionRing({ percent }: { percent: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke={LINE} strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={GOLD} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span style={{ position: 'absolute', fontSize: 22, fontWeight: 700, color: NAVY }}>{percent}%</span>
    </div>
  );
}

function PdfIcon() {
  return (
    <div style={{ width: 40, height: 48, background: `linear-gradient(135deg,${NAVY} 0%,${NAVY_800} 100%)`,
      borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '.04em' }}>
      PDF
    </div>
  );
}

function DownloadBtn() {
  return (
    <button style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${LINE}`,
      background: 'white', color: NAVY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Download
    </button>
  );
}

// ─── Section: Home ────────────────────────────────────────────────────────────
function HomeSection({ onNav }: { onNav: (s: NavSection) => void }) {
  const actions = [
    { label: 'Documents purchased', done: true },
    { label: 'Documents executed (signed)', done: false },
    { label: 'Vault populated', done: false },
    { label: 'Assets funded', done: false },
  ];
  const done = actions.filter((a) => a.done).length;
  const pct = Math.round((done / actions.length) * 100);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ borderRadius: 14, background: NAVY, padding: '20px 24px', borderLeft: `4px solid ${GOLD}` }}>
        <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>
          Welcome back, {DEMO_FIRST}.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Your {PACKAGE} is ready for review.
        </p>
      </div>

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Completion ring */}
        <div style={{ borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, padding: 24, textAlign: 'center' }}>
          <CompletionRing percent={pct} />
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: NAVY }}>Plan Completion</p>
          <div style={{ marginTop: 12, textAlign: 'left' }}>
            {actions.map((a) => (
              <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 }}>
                <span>{a.done ? '✅' : '⬜'}</span>
                <span style={{ color: a.done ? CHARCOAL : 'rgba(45,41,38,0.4)' }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next step */}
        <div style={{ borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: GOLD_600, margin: 0 }}>Next Step</p>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginTop: 6, marginBottom: 0 }}>Sign your documents</h2>
          <p style={{ fontSize: 13, color: 'rgba(45,41,38,0.6)', marginTop: 8, lineHeight: 1.5 }}>
            Follow the execution guide to properly sign and witness your documents.
          </p>
          <button
            onClick={() => onNav('documents')}
            style={{ marginTop: 16, padding: '10px 22px', borderRadius: 24, background: GOLD, border: 'none',
              color: NAVY, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            View Documents →
          </button>
        </div>
      </div>

      {/* Package summary */}
      <div style={{ marginTop: 16, borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>{PACKAGE}</h2>
          <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
            Generated
          </span>
        </div>
        <div style={{ marginTop: 16 }}>
          {DOCS.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: CHARCOAL }}>{d.name}</span>
              <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✅ Ready</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNav('documents')} style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(63,45,24,0.5)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
          View all documents →
        </button>
      </div>
    </div>
  );
}

// ─── Section: Documents ───────────────────────────────────────────────────────
function DocumentsSection() {
  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 6 }}>My Documents</h1>
      <p style={{ fontSize: 14, color: 'rgba(45,41,38,0.6)', marginBottom: 24 }}>
        Reviewed &amp; approved by Khan Law Group · Apr 17, 2026
      </p>

      <div style={{ borderRadius: 14, background: NAVY, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Your Trust Package is ready.</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>All 4 documents reviewed and signed off</div>
        </div>
        <div style={{ marginLeft: 'auto', background: GOLD, color: NAVY, borderRadius: 10, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
          Delivered
        </div>
      </div>

      <div style={{ borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
        {DOCS.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
            borderBottom: i < DOCS.length - 1 ? `1px solid ${LINE}` : 'none' }}>
            <PdfIcon />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: NAVY }}>{d.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(45,41,38,0.5)', marginTop: 3 }}>
                {d.pages} pages · {d.size} · Updated today
              </div>
            </div>
            <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600, marginRight: 8 }}>
              Signed
            </span>
            <DownloadBtn />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}`, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Execution guide</h3>
        <p style={{ fontSize: 13, color: 'rgba(45,41,38,0.7)', lineHeight: 1.6 }}>
          To make your documents legally binding, follow these steps:
        </p>
        <ol style={{ fontSize: 13, color: CHARCOAL, lineHeight: 2, paddingLeft: 18, marginTop: 8 }}>
          <li>Print each document or prepare for digital signature</li>
          <li>Sign in the presence of two disinterested witnesses</li>
          <li>Have signatures notarized where required</li>
          <li>Store originals in a safe location and note the location in your Vault</li>
        </ol>
      </div>
    </div>
  );
}

// ─── Section: Vault ───────────────────────────────────────────────────────────
function VaultSection() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [error, setError] = useState('');

  function tryUnlock() {
    if (pin === '1234') { setUnlocked(true); setError(''); }
    else setError('Incorrect PIN. (Hint: 1234)');
  }

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 400, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>Your Vault</h2>
        <p style={{ fontSize: 13, color: 'rgba(45,41,38,0.6)', marginTop: 6 }}>AES-256 encrypted · Enter your PIN to access</p>
        <div style={{ marginTop: 24 }}>
          <input
            type="password"
            placeholder="Enter vault PIN"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${LINE}`,
              fontSize: 18, textAlign: 'center', letterSpacing: 8, outline: 'none', boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{error}</p>}
          <button onClick={tryUnlock} style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 10,
            background: NAVY, border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Unlock Vault
          </button>
        </div>
      </div>
    );
  }

  if (activeCategory) {
    const cat = VAULT_CATEGORIES.find((c) => c.id === activeCategory)!;
    return (
      <div style={{ maxWidth: 720 }}>
        <button onClick={() => setActiveCategory(null)} style={{ background: 'none', border: 'none', padding: 0,
          color: 'rgba(63,45,24,0.5)', fontSize: 13, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back to Vault
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 28 }}>{cat.icon}</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0 }}>{cat.name}</h1>
        </div>
        {cat.id === 'docs' ? (
          <div style={{ borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
            {DOCS.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
                borderBottom: i < DOCS.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <PdfIcon />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: NAVY }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(45,41,38,0.5)', marginTop: 3 }}>{d.pages} pages · {d.size}</div>
                </div>
                <DownloadBtn />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ borderRadius: 14, background: SURFACE, border: `1px dashed ${LINE}`, padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 24, marginBottom: 8 }}>{cat.icon}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>No items yet</p>
            <p style={{ fontSize: 13, color: 'rgba(45,41,38,0.5)', marginTop: 4 }}>Add your {cat.name.toLowerCase()} to keep them secure and accessible to your trustees.</p>
            <button style={{ marginTop: 16, padding: '10px 22px', borderRadius: 24, background: NAVY, border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              + Add Item
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0 }}>Your Vault</h1>
          <p style={{ fontSize: 13, color: 'rgba(45,41,38,0.5)', marginTop: 4 }}>AES-256 encrypted · PIN protected</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Unlocked</span>
          <button onClick={() => setUnlocked(false)} style={{ marginLeft: 8, background: 'none', border: `1px solid ${LINE}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, color: 'rgba(45,41,38,0.5)', cursor: 'pointer' }}>Lock</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {VAULT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{ position: 'relative', borderRadius: 12, background: cat.count > 0 ? NAVY : 'white',
              border: `1.5px solid ${cat.count > 0 ? NAVY : LINE}`, padding: '20px 16px',
              textAlign: 'left', cursor: 'pointer', transition: 'all .2s' }}>
            {cat.count > 0 && (
              <span style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%',
                background: GOLD, color: NAVY, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cat.count}
              </span>
            )}
            <div style={{ fontSize: 24, marginBottom: 8 }}>{cat.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: cat.count > 0 ? 'white' : NAVY, lineHeight: 1.3 }}>{cat.name}</div>
            <div style={{ fontSize: 11, color: cat.count > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(45,41,38,0.4)', marginTop: 4 }}>
              {cat.count > 0 ? `${cat.count} item${cat.count > 1 ? 's' : ''}` : 'Empty'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Life Events ─────────────────────────────────────────────────────
function LifeEventsSection() {
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function toggle(id: number) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, textAlign: 'center', margin: '60px auto' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>Update request sent!</h2>
        <p style={{ fontSize: 14, color: 'rgba(45,41,38,0.6)', marginTop: 8 }}>
          {
            "Khan Law Group will review the changes and update your documents. You'll be notified by email."
          }
        </p>
        <button onClick={() => { setSubmitted(false); setSelected([]); }}
          style={{ marginTop: 20, padding: '10px 24px', borderRadius: 24, background: NAVY, border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Back to Life Events
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Life Events</h1>
      <p style={{ fontSize: 14, color: 'rgba(45,41,38,0.6)', marginBottom: 24 }}>
        {
          "Review your plan when life changes. Select all that apply and we'll send an amendment recommendation."
        }
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {LIFE_EVENTS.map((e) => {
          const active = selected.includes(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              style={{ borderRadius: 12, background: active ? NAVY : 'white', border: `2px solid ${active ? NAVY : LINE}`,
                padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all .2s' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{e.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'white' : NAVY }}>{e.label}</div>
            </button>
          );
        })}
      </div>

      <button
        disabled={selected.length === 0}
        onClick={() => setSubmitted(true)}
        style={{ padding: '12px 28px', borderRadius: 24, background: selected.length > 0 ? GOLD : LINE,
          border: 'none', color: selected.length > 0 ? NAVY : 'rgba(45,41,38,0.3)', fontWeight: 700,
          fontSize: 14, cursor: selected.length > 0 ? 'pointer' : 'not-allowed', transition: 'all .2s' }}>
        Request Plan Update{selected.length > 0 ? ` (${selected.length})` : ''}
      </button>
    </div>
  );
}

// ─── Section: Settings ────────────────────────────────────────────────────────
function SettingsSection() {
  const [email, setEmail] = useState('sarah.thompson@email.com');
  const [name, setName] = useState(DEMO_NAME);
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 24 }}>Settings</h1>

      <div style={{ borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${LINE}`, background: SURFACE }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(45,41,38,0.5)', margin: 0 }}>Profile</p>
        </div>
        <div style={{ padding: '20px' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Full name</label>
          <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${LINE}`,
              fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Email</label>
          <input value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${LINE}`,
              fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />
          <button onClick={() => setSaved(true)}
            style={{ padding: '10px 22px', borderRadius: 24, background: NAVY, border: 'none',
              color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      <div style={{ borderRadius: 14, background: 'white', border: `1px solid ${LINE}`, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${LINE}`, background: SURFACE }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(45,41,38,0.5)', margin: 0 }}>Partner</p>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, fontWeight: 700, fontSize: 16 }}>K</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: NAVY }}>Khan Law Group</div>
              <div style={{ fontSize: 12, color: 'rgba(45,41,38,0.5)' }}>Estate Planning · Michigan</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 14, background: '#fef2f2', border: '1px solid #fecaca', padding: '16px 20px', marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', margin: 0 }}>Sign out of this demo session</p>
        <Link href="/khan-lawgroup" style={{ display: 'inline-block', marginTop: 8, padding: '8px 18px', borderRadius: 20,
          background: '#dc2626', color: 'white', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
          Return to Khan Law Group ↗
        </Link>
      </div>
    </div>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'documents', label: 'My Documents', icon: '📄' },
  { id: 'vault', label: 'My Vault', icon: '🔐' },
  { id: 'life-events', label: 'Life Events', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DemoDashboard() {
  const [section, setSection] = useState<NavSection>('home');
  const [mobileOpen, setMobileOpen] = useState(false);

  function SidebarContent() {
    return (
      <>
        <div style={{ padding: '20px 20px 14px', borderBottom: `1px solid rgba(239,186,129,0.15)` }}>
          <Link href="/khan-lawgroup" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: NAVY }}>K</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>Khan Law Group</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>Client Portal</div>
            </div>
          </Link>
        </div>

        <nav style={{ flex: 1, padding: '8px 10px' }}>
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setMobileOpen(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 8, border: 'none', background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: active ? 'white' : 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'all .15s' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '14px 20px', borderTop: `1px solid rgba(239,186,129,0.15)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: NAVY }}>ST</div>
            <div>
              <div style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{DEMO_NAME}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Demo session</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: SURFACE, fontFamily: 'Inter, system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* Desktop sidebar */}
      <aside style={{ position: 'fixed', left: 0, top: 0, width: 220, height: '100vh', background: NAVY,
        display: 'flex', flexDirection: 'column', zIndex: 40 }}
        className="hidden-mobile">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, background: NAVY, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 40 }}
        className="show-mobile">
        <Link href="/khan-lawgroup" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: NAVY }}>K</div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Khan Law Group</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer' }}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile slide-out */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} className="show-mobile">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: 240, height: '100%', background: NAVY, display: 'flex', flexDirection: 'column' }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: `1px solid ${LINE}`,
        display: 'flex', justifyContent: 'space-around', padding: '8px 0', zIndex: 40 }}
        className="show-mobile">
        {NAV_ITEMS.map((item) => (
          <button key={item.id} onClick={() => setSection(item.id)}
            style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, padding: '4px 8px', cursor: 'pointer', color: section === item.id ? NAVY : '#9ca3af',
              fontWeight: section === item.id ? 700 : 400, fontSize: 10 }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label.split(' ')[0]}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: 220, minHeight: '100vh', padding: '32px 40px' }}
        className="main-content">
        {section === 'home' && <HomeSection onNav={setSection} />}
        {section === 'documents' && <DocumentsSection />}
        {section === 'vault' && <VaultSection />}
        {section === 'life-events' && <LifeEventsSection />}
        {section === 'settings' && <SettingsSection />}
      </main>

      <style>{`
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          .main-content { margin-left: 0 !important; padding: 80px 16px 80px !important; }
        }
        @media (min-width: 768px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
