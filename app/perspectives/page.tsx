'use client';

import { useState } from 'react';

const C = {
  bg: '#FFFFFF',
  primary: '#F2D7C1',
  text: '#322E2C',
};

const S = {
  page: {
    background: C.bg,
    minHeight: '100vh',
    fontFamily: 'Inter, sans-serif',
    color: C.text,
  } as React.CSSProperties,

  header: {
    background: C.primary,
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${C.text}20`,
  } as React.CSSProperties,

  brand: {
    fontWeight: 700,
    fontSize: 18,
    color: C.text,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  toggleRow: {
    display: 'flex',
    gap: 8,
  } as React.CSSProperties,

  toggleBtn: (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    borderRadius: 8,
    border: `1.5px solid ${C.text}`,
    background: active ? C.text : 'transparent',
    color: active ? C.bg : C.text,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),

  splitWrap: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: 'calc(100vh - 57px)',
  } as React.CSSProperties,

  singleWrap: {
    maxWidth: 780,
    margin: '0 auto',
    padding: '40px 32px',
    width: '100%',
  } as React.CSSProperties,

  panel: (border?: boolean): React.CSSProperties => ({
    padding: '40px 32px',
    borderRight: border ? `1px solid ${C.text}15` : 'none',
  }),

  panelLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: `${C.text}80`,
    marginBottom: 24,
  } as React.CSSProperties,

  panelTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
    lineHeight: 1.2,
    color: C.text,
  } as React.CSSProperties,

  panelSub: {
    fontSize: 13,
    color: `${C.text}70`,
    marginBottom: 28,
  } as React.CSSProperties,

  card: {
    background: C.primary,
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 16,
  } as React.CSSProperties,

  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  cardLabel: {
    fontSize: 12,
    color: `${C.text}70`,
    marginBottom: 4,
  } as React.CSSProperties,

  cardValue: {
    fontSize: 20,
    fontWeight: 700,
    color: C.text,
  } as React.CSSProperties,

  badge: (color?: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: color || `${C.text}15`,
    color: C.text,
  }),

  divider: {
    height: 1,
    background: `${C.text}10`,
    margin: '20px 0',
  } as React.CSSProperties,

  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: `1px solid ${C.text}10`,
  } as React.CSSProperties,

  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: C.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 12,
    color: C.text,
    flexShrink: 0,
    border: `1.5px solid ${C.text}20`,
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 24,
  } as React.CSSProperties,

  statCard: {
    background: C.primary,
    borderRadius: 10,
    padding: '16px 20px',
  } as React.CSSProperties,

  btn: (filled?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 8,
    border: `1.5px solid ${C.text}`,
    background: filled ? C.text : 'transparent',
    color: filled ? C.bg : C.text,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
  }),

  inputWrap: {
    marginBottom: 16,
  } as React.CSSProperties,

  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: `${C.text}80`,
    marginBottom: 6,
    display: 'block',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1.5px solid ${C.text}25`,
    background: C.bg,
    color: C.text,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,

  progressBar: (pct: number): React.CSSProperties => ({
    height: 6,
    borderRadius: 99,
    background: `${C.text}15`,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  }),

  progressFill: (pct: number): React.CSSProperties => ({
    height: '100%',
    width: `${pct}%`,
    background: C.text,
    borderRadius: 99,
  }),

  quizOpt: (sel: boolean): React.CSSProperties => ({
    padding: '14px 18px',
    borderRadius: 10,
    border: `1.5px solid ${sel ? C.text : C.text + '20'}`,
    background: sel ? C.primary : C.bg,
    marginBottom: 10,
    cursor: 'pointer',
    fontWeight: sel ? 600 : 400,
    fontSize: 14,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  }),

  checkCircle: (sel: boolean): React.CSSProperties => ({
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `2px solid ${sel ? C.text : C.text + '30'}`,
    background: sel ? C.text : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),

  tabRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    background: C.primary,
    padding: 4,
    borderRadius: 10,
  } as React.CSSProperties,

  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    textAlign: 'center' as const,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    background: active ? C.bg : 'transparent',
    color: C.text,
    cursor: 'pointer',
    border: 'none',
  }),

  sectionHead: {
    marginBottom: 20,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 2,
    color: C.text,
  } as React.CSSProperties,
};

const CLIENTS = [
  { init: 'SM', name: 'Sarah M.', pkg: 'Trust Package', status: 'Review pending', time: '2h ago', urgent: true },
  { init: 'JT', name: 'James T.', pkg: 'Will Package', status: 'Delivered', time: '1d ago', urgent: false },
  { init: 'LP', name: 'Linda P.', pkg: 'Trust Package', status: 'Complex — flagged', time: '3d ago', urgent: false },
  { init: 'RK', name: 'Robert K.', pkg: 'Will Package', status: 'In progress', time: '4d ago', urgent: false },
];

function CheckIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AttorneyView() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={S.panel(true)}>
      <div style={S.panelLabel}>Your view — Attorney Dashboard</div>
      <div style={S.panelTitle}>Khan Law Group</div>
      <div style={S.panelSub}>White-labeled practice portal · legacy.khanlaw.com</div>

      <div style={S.tabRow}>
        {['Overview', 'Review Queue', 'Earnings'].map((t, i) => (
          <button key={t} style={S.tab(activeTab === i)} onClick={() => setActiveTab(i)}>{t}</button>
        ))}
      </div>

      {activeTab === 0 && (
        <>
          <div style={S.statsGrid}>
            <div style={S.statCard}>
              <div style={S.cardLabel}>This month</div>
              <div style={S.cardValue}>$4,200</div>
              <div style={{ fontSize: 11, color: `${C.text}60`, marginTop: 2 }}>12 packages</div>
            </div>
            <div style={S.statCard}>
              <div style={S.cardLabel}>Review queue</div>
              <div style={S.cardValue}>3</div>
              <div style={{ fontSize: 11, color: `${C.text}60`, marginTop: 2 }}>1 urgent</div>
            </div>
            <div style={S.statCard}>
              <div style={S.cardLabel}>Complex flagged</div>
              <div style={S.cardValue}>2</div>
              <div style={{ fontSize: 11, color: `${C.text}60`, marginTop: 2 }}>full engagements</div>
            </div>
            <div style={S.statCard}>
              <div style={S.cardLabel}>Review fee</div>
              <div style={S.cardValue}>$350</div>
              <div style={{ fontSize: 11, color: `${C.text}60`, marginTop: 2 }}>100% to you</div>
            </div>
          </div>

          <div style={S.sectionHead}>
            <div style={S.sectionTitle}>Recent clients</div>
          </div>
          {CLIENTS.slice(0, 3).map((c) => (
            <div key={c.name} style={S.listItem}>
              <div style={S.avatar}>{c.init}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: `${C.text}60` }}>{c.pkg}</div>
              </div>
              <span style={S.badge(c.urgent ? `${C.primary}` : undefined)}>{c.status}</span>
            </div>
          ))}
        </>
      )}

      {activeTab === 1 && (
        <>
          <div style={{ ...S.card, marginBottom: 12, border: `1.5px solid ${C.text}30` }}>
            <div style={S.cardRow}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Sarah M. — Trust Package</div>
                <div style={{ fontSize: 12, color: `${C.text}60`, marginTop: 2 }}>32 pages · Ready for review</div>
              </div>
              <span style={S.badge(`${C.primary}`)}>Urgent · 36h SLA</span>
            </div>
            <div style={S.divider} />
            <div style={{ fontSize: 12, color: `${C.text}70`, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>REVOCABLE LIVING TRUST OF SARAH M. THOMPSON</strong><br />
              I, Sarah M. Thompson, of Washtenaw County, Michigan, hereby declare this Revocable Living Trust for the benefit of my family…
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...S.btn(false), marginTop: 0, flex: 1 }}>Request revision</button>
              <button style={{ ...S.btn(true), marginTop: 0, flex: 1 }}>Approve &amp; sign</button>
            </div>
          </div>

          {CLIENTS.slice(1, 3).map((c) => (
            <div key={c.name} style={S.listItem}>
              <div style={S.avatar}>{c.init}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{c.name} — {c.pkg}</div>
                <div style={{ fontSize: 11, color: `${C.text}60` }}>{c.time}</div>
              </div>
              <span style={S.badge()}>{c.status}</span>
            </div>
          ))}
        </>
      )}

      {activeTab === 2 && (
        <>
          <div style={S.card}>
            <div style={S.cardLabel}>Total earned this month</div>
            <div style={{ ...S.cardValue, fontSize: 32 }}>$4,200</div>
            <div style={{ fontSize: 12, color: `${C.text}60`, marginTop: 4 }}>Payback period: 0.3 months</div>
          </div>

          {[
            { label: 'Trust packages × 8', sub: '$400 per package', val: '$3,200' },
            { label: 'Will packages × 4', sub: '$300 per package', val: '$1,200' },
            { label: 'Attorney review fees × 9', sub: '$350 per review, 100% yours', val: '+$3,150' },
          ].map((row) => (
            <div key={row.label} style={{ ...S.listItem, justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{row.label}</div>
                <div style={{ fontSize: 11, color: `${C.text}60` }}>{row.sub}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{row.val}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ClientView() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const steps = ['Quiz', 'Results', 'Documents', 'Vault'];

  return (
    <div style={S.panel()}>
      <div style={S.panelLabel}>Client view — legacy.khanlaw.com</div>
      <div style={S.panelTitle}>Khan Law Group Legacy</div>
      <div style={S.panelSub}>Secure estate planning · Reviewed by your attorney</div>

      <div style={S.tabRow}>
        {steps.map((t, i) => (
          <button key={t} style={S.tab(step === i)} onClick={() => { setStep(i); setSelected(null); }}>{t}</button>
        ))}
      </div>

      {step === 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: `${C.text}60` }}>Step 3 of 10</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>30%</span>
          </div>
          <div style={S.progressBar(30)}>
            <div style={S.progressFill(30)} />
          </div>
          <div style={{ marginTop: 28, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>
              Do you own real estate in Michigan?
            </div>
            <div style={{ fontSize: 13, color: `${C.text}60`, lineHeight: 1.6 }}>
              This helps determine whether a trust may benefit your family by avoiding probate.
            </div>
          </div>
          {['Yes, I own Michigan real estate', 'No, I do not own real estate'].map((opt, i) => (
            <div key={opt} style={S.quizOpt(selected === i)} onClick={() => setSelected(i)}>
              <div style={S.checkCircle(selected === i)}>
                {selected === i && <CheckIcon size={8} />}
              </div>
              {opt}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button style={{ ...S.btn(false), marginTop: 0 }}>← Back</button>
            <button style={{ ...S.btn(true), marginTop: 0 }} onClick={() => setStep(1)}>Continue →</button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${C.text}60`, marginBottom: 8 }}>
              Your match
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, marginBottom: 8, color: C.text }}>
              Based on your answers, a <em>Trust Package</em> fits your situation best.
            </div>
            <div style={{ fontSize: 12, color: `${C.text}70`, lineHeight: 1.6, marginBottom: 16 }}>
              Recommended because you own Michigan real estate, have minor children, and value privacy from probate.
            </div>
            {['Revocable Living Trust', 'Pour-Over Will', 'Durable Power of Attorney', 'Patient Advocate Designation'].map((d) => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ ...S.checkCircle(true), width: 16, height: 16 }}>
                  <CheckIcon size={7} />
                </div>
                <span style={{ fontSize: 13, color: C.text }}>{d}</span>
              </div>
            ))}
            <div style={S.divider} />
            <div style={S.cardRow}>
              <div>
                <div style={{ fontSize: 11, color: `${C.text}60` }}>Trust Package</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>$600</div>
              </div>
              <button style={{ ...S.btn(true), marginTop: 0, width: 'auto', padding: '10px 24px' }}>Get started →</button>
            </div>
          </div>
          <div style={{ ...S.card, background: C.bg, border: `1px solid ${C.text}15` }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: C.text }}>Other options</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.text }}>Will Package</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>$400</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: C.text }}>+ Attorney Review</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>+$300</span>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.text}30`, flexShrink: 0 }}>
              <CheckIcon size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Your Trust Package is ready.</div>
              <div style={{ fontSize: 12, color: `${C.text}60`, marginTop: 2 }}>Reviewed by Rachel Harding, Esq. · Apr 17, 2026</div>
            </div>
            <span style={{ ...S.badge(), marginLeft: 'auto', whiteSpace: 'nowrap' as const }}>Delivered</span>
          </div>

          {[
            { n: 'Revocable Living Trust', p: '32 pages', s: '248 KB' },
            { n: 'Pour-Over Will', p: '8 pages', s: '62 KB' },
            { n: 'Durable Power of Attorney', p: '6 pages', s: '48 KB' },
            { n: 'Patient Advocate Designation', p: '4 pages', s: '36 KB' },
          ].map((d) => (
            <div key={d.n} style={{ ...S.listItem, gap: 12 }}>
              <div style={{ background: C.primary, borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: C.text, flexShrink: 0 }}>PDF</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{d.n}</div>
                <div style={{ fontSize: 11, color: `${C.text}60` }}>{d.p} · {d.s}</div>
              </div>
              <span style={S.badge()}>Signed</span>
            </div>
          ))}
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Your Vault</div>
              <div style={{ fontSize: 12, color: `${C.text}60`, marginTop: 2 }}>AES-256 encrypted · PIN protected</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: C.text }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { n: 'Estate Documents', c: '4 items', active: true },
              { n: 'Financial Accounts', c: 'Empty', active: false },
              { n: 'Insurance Policies', c: 'Empty', active: false },
              { n: 'Digital Accounts', c: 'Empty', active: false },
              { n: 'Physical Locations', c: 'Empty', active: false },
              { n: 'Important Contacts', c: 'Empty', active: false },
            ].map((item) => (
              <div key={item.n} style={{
                background: item.active ? C.primary : C.bg,
                border: `1.5px solid ${item.active ? C.text + '30' : C.text + '12'}`,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>{item.n}</div>
                <div style={{ fontSize: 11, color: `${C.text}60` }}>{item.c}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PerspectivesPage() {
  const [view, setView] = useState<'split' | 'attorney' | 'client'>('split');

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brand}>EstateVault — Two Perspectives</div>
        <div style={S.toggleRow}>
          {(['split', 'attorney', 'client'] as const).map((v) => (
            <button key={v} style={S.toggleBtn(view === v)} onClick={() => setView(v)}>
              {v === 'split' ? 'Split view' : v === 'attorney' ? 'Your view' : 'Client view'}
            </button>
          ))}
        </div>
      </header>

      {view === 'split' && (
        <div style={S.splitWrap}>
          <AttorneyView />
          <ClientView />
        </div>
      )}

      {view === 'attorney' && (
        <div style={S.singleWrap}>
          <AttorneyView />
        </div>
      )}

      {view === 'client' && (
        <div style={S.singleWrap}>
          <ClientView />
        </div>
      )}
    </div>
  );
}
