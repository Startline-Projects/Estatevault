'use client';

// ─── Khan Law Group palette ───────────────────────────────────────────────────
const NAVY = '#000000';
const GOLD = '#F2D7C1';
const GOLD_600 = '#c4a48a';
const SURFACE = '#F2D7C1';
const LINE = 'rgba(0,0,0,0.08)';
const CHARCOAL = '#000000';

// ─── Demo data ────────────────────────────────────────────────────────────────
const PENDING = [
  { id: '1', client: 'Sarah Thompson', email: 'sarah.t@email.com', pkg: 'Trust', partner: 'Khan Law Group', submitted: 'Apr 19', hoursLeft: 36 },
  { id: '2', client: 'James Kowalski', email: 'j.kowalski@email.com', pkg: 'Will', partner: 'Khan Law Group', submitted: 'Apr 20', hoursLeft: 56 },
  { id: '3', client: 'Linda Pham', email: 'lpham@email.com', pkg: 'Trust', partner: 'Khan Law Group', submitted: 'Apr 18', hoursLeft: 8 },
];

const COMPLETED = [
  { id: '4', client: 'Mark Rivera', email: 'm.rivera@email.com', pkg: 'Will', partner: 'Khan Law Group', date: 'Apr 15', status: 'Approved' },
  { id: '5', client: 'Diane Chen', email: 'diane.c@email.com', pkg: 'Trust', partner: 'Khan Law Group', date: 'Apr 12', status: 'Approved w/ Notes' },
  { id: '6', client: 'Robert Nguyen', email: 'r.nguyen@email.com', pkg: 'Will', partner: 'Khan Law Group', date: 'Apr 9', status: 'Approved' },
];

function SLABadge({ hours }: { hours: number }) {
  if (hours < 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', color: '#b91c1c',
        borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
        Overdue
      </span>
    );
  }
  if (hours < 12) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ffedd5', color: '#c2410c',
        borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        {hours}h left
      </span>
    );
  }
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(63,45,24,0.07)', color: NAVY,
      borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      {d > 0 ? `${d}d ${h}h` : `${hours}h`} left
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Approved': { bg: '#dcfce7', color: '#15803d' },
    'Approved w/ Notes': { bg: '#fef9c3', color: '#a16207' },
    'Flagged': { bg: '#fee2e2', color: '#b91c1c' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(45,41,38,0.45)',
  background: SURFACE, borderBottom: `1px solid ${LINE}`,
};
const TD: React.CSSProperties = {
  padding: '12px 16px', borderBottom: `1px solid ${LINE}`, fontSize: 13,
};

export default function AttorneyDemoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}>

      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: `1px solid ${LINE}`, padding: '14px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: GOLD,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: 14 }}>
              K
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, margin: 0 }}>Omar Khan, Esq.</p>
              <p style={{ fontSize: 11, color: 'rgba(45,41,38,0.45)', margin: 0 }}>Review Attorney · Khan Law Group</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Active</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 24px 40px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Pending Review', value: PENDING.length },
            { label: 'Completed', value: COMPLETED.length },
            { label: 'SLA Window', value: '4 days' },
          ].map((s) => (
            <div key={s.label} style={{ borderRadius: 12, background: 'white', border: `1px solid ${LINE}`, padding: '16px 20px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(45,41,38,0.45)', margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: NAVY, margin: '6px 0 0' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pending */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>Pending Reviews</h2>
            <span style={{ background: `rgba(239,186,129,0.18)`, color: GOLD_600, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
              {PENDING.length}
            </span>
          </div>
          <div style={{ borderRadius: 12, background: 'white', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Client</th>
                  <th style={TH}>Package</th>
                  <th style={TH}>Partner</th>
                  <th style={TH}>Submitted</th>
                  <th style={TH}>SLA</th>
                  <th style={{ ...TH, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {PENDING.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'white' : 'rgba(242,215,193,0.25)' }}>
                    <td style={TD}>
                      <p style={{ fontWeight: 600, color: NAVY, margin: 0 }}>{r.client}</p>
                      <p style={{ fontSize: 11, color: 'rgba(45,41,38,0.4)', margin: '2px 0 0' }}>{r.email}</p>
                    </td>
                    <td style={TD}>
                      <span style={{ background: `rgba(63,45,24,0.07)`, color: NAVY, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                        {r.pkg} Package
                      </span>
                    </td>
                    <td style={{ ...TD, color: 'rgba(45,41,38,0.6)' }}>{r.partner}</td>
                    <td style={{ ...TD, color: 'rgba(45,41,38,0.5)' }}>{r.submitted}</td>
                    <td style={TD}><SLABadge hours={r.hoursLeft} /></td>
                    <td style={{ ...TD, textAlign: 'right', borderBottom: `1px solid ${LINE}` }}>
                      <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px',
                        borderRadius: 8, background: '#000', border: 'none', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        Review
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Completed */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 14px' }}>Completed ({COMPLETED.length})</h2>
          <div style={{ borderRadius: 12, background: 'white', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Client</th>
                  <th style={TH}>Package</th>
                  <th style={TH}>Partner</th>
                  <th style={TH}>Date</th>
                  <th style={TH}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {COMPLETED.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'white' : 'rgba(242,215,193,0.25)' }}>
                    <td style={TD}>
                      <p style={{ fontWeight: 600, color: NAVY, margin: 0 }}>{r.client}</p>
                      <p style={{ fontSize: 11, color: 'rgba(45,41,38,0.4)', margin: '2px 0 0' }}>{r.email}</p>
                    </td>
                    <td style={TD}>
                      <span style={{ background: `rgba(63,45,24,0.07)`, color: NAVY, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                        {r.pkg} Package
                      </span>
                    </td>
                    <td style={{ ...TD, color: 'rgba(45,41,38,0.6)' }}>{r.partner}</td>
                    <td style={{ ...TD, color: 'rgba(45,41,38,0.5)' }}>{r.date}</td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
