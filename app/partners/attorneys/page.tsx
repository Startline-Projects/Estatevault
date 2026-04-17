'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './attorneys.module.css';

const STANDARD_FEATURES = [
  'Unlimited document generation',
  'Branded client-facing platform',
  'Reviewing attorney role on all documents',
  'Set your own review fee ($150 to $1,500)',
  '$300/will + your review fee',
  '$400/trust + your review fee',
  'White-labeled marketing materials',
  '3 team seats included',
];

const PROFESSIONAL_FEATURES: Array<{ text: string; strong?: boolean }> = [
  { text: 'Everything in Standard, plus:', strong: true },
  { text: '$350/will + your review fee' },
  { text: '$500/trust + your review fee' },
  { text: '10 team seats included' },
  { text: 'Commission hierarchy for associates' },
  { text: 'Priority placement in referral network' },
  { text: 'Dedicated onboarding specialist' },
];

const ENTERPRISE_FEATURES: Array<{ text: string; strong?: boolean }> = [
  { text: 'Everything in Professional, plus:', strong: true },
  { text: 'Custom pricing structure' },
  { text: 'Multi-firm / multi-location support' },
  { text: 'Custom CRM integrations' },
  { text: 'Dedicated account manager' },
  { text: 'White-glove onboarding' },
  { text: 'SLA guarantees' },
];

const FAQ_ITEMS = [
  {
    q: 'Am I the attorney of record on these documents?',
    a: 'Yes. Your name and bar number appear on every document you review and approve. EstateVault is a document preparation platform, you remain the professional of record on every engagement.',
  },
  {
    q: 'Can I set my own review fee?',
    a: 'Absolutely. You choose any review fee between $150 and $1,500. 100% of your review fee flows directly to you, EstateVault takes nothing from that amount.',
  },
  {
    q: 'What happens with complex cases?',
    a: "If a client's intake indicates an irrevocable trust, special needs planning, Medicaid asset protection, or business succession, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.",
  },
  {
    q: 'Are the documents compliant with Michigan law?',
    a: 'All templates were developed in collaboration with Michigan-licensed attorneys with over 40 years of combined estate planning experience, fully compliant with the Michigan Estates and Protected Individuals Code (EPIC).',
  },
  {
    q: 'Is this a subscription?',
    a: 'No. The platform fee is one-time. No monthly charges. No renewal fees. You pay once and own your white-label portal.',
  },
  {
    q: 'How long does onboarding take?',
    a: 'Standard tier: self-serve onboarding in ~48 hours. Professional tier: dedicated onboarding specialist walks you through everything in 3 to 5 business days. Enterprise: white-glove onboarding tailored to your firm.',
  },
];

const ArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

const Check = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export default function AttorneyPartnerPage() {
  const [calcTier, setCalcTier] = useState<'standard' | 'professional'>('standard');
  const [calcVolume, setCalcVolume] = useState(5);
  const [calcReviewFee, setCalcReviewFee] = useState(300);
  const [demoTab, setDemoTab] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const revealRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealIn);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealRefs.current.forEach((el) => {
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const isPromoValid = promoCode.trim().toUpperCase() === 'TPFP';
  const promoActive = promoApplied && isPromoValid;

  const trustSplit = calcTier === 'standard' ? 400 : 500;
  const platformFee = promoActive ? 0 : calcTier === 'standard' ? 1200 : 6000;
  const trustEarnings = trustSplit * calcVolume;
  const reviewEarnings = calcReviewFee > 0 ? calcReviewFee * calcVolume : 0;
  const totalMonthly = trustEarnings + reviewEarnings;
  const paybackRatio = totalMonthly > 0 ? platformFee / totalMonthly : Infinity;
  const paybackText =
    platformFee === 0
      ? 'already free'
      : paybackRatio < 1
      ? 'less than 1 month'
      : paybackRatio <= 1
      ? '1 month'
      : `${Math.ceil(paybackRatio * 2) / 2} months`;

  function scrollTo(id: string) {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  const registerReveal = (idx: number) => (el: HTMLElement | null) => {
    revealRefs.current[idx] = el;
  };

  const demoTabs = [
    {
      label: 'Quiz',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r=".5" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: 'Results',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
        </svg>
      ),
    },
    {
      label: 'Documents',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      ),
    },
    {
      label: 'The Vault',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      label: 'Your Review',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`${styles.page} font-sans`}>
      {/* ============ NAV ============ */}
      <header className={`${styles.navWrap} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.nav}>
          <Link href="#top" className={styles.brand} onClick={() => setMobileMenuOpen(false)}>
            <span className={styles.logomark}>
              <span>E</span>
            </span>
            EstateVault
            <span className={styles.brandTag}>Pro</span>
          </Link>
          <nav className={styles.navLinks}>
            <a href="#how">How it works</a>
            <a href="#demo">Client experience</a>
            <a href="#pricing">Pricing</a>
            <a href="#calculator">Earnings</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={styles.navCta}>
            <Link
              href="https://www.estatevault.us/partners/attorneys/review-network"
              className={styles.btnPrimary}
            >
              Become a Review Attorney
              <span className={styles.arrow}>
                <ArrowRight />
              </span>
            </Link>
            <button
              className={styles.mobileToggle}
              aria-label="Menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <span />
            </button>
          </div>
        </div>
        <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.open : ''}`}>
          <a href="#how" onClick={() => setMobileMenuOpen(false)}>How it works</a>
          <a href="#demo" onClick={() => setMobileMenuOpen(false)}>Client experience</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <a href="#calculator" onClick={() => setMobileMenuOpen(false)}>Earnings</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
          <Link
            href="https://www.estatevault.us/partners/attorneys/review-network"
            onClick={() => setMobileMenuOpen(false)}
            className={styles.btnPrimary}
          >
            Become a Review Attorney <ArrowRight />
          </Link>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className={styles.hero} id="top">
        <div className={`${styles.floatCard} ${styles.fc1}`}>
          <div className={styles.floatIc}>✓</div>
          <div>
            <div style={{ fontWeight: 600 }}>Trust drafted</div>
            <div style={{ opacity: 0.6, fontSize: 11 }}>Sarah M., 3 min ago</div>
          </div>
        </div>
        <div className={`${styles.floatCard} ${styles.fc2}`}>
          <div className={styles.floatIc}>$</div>
          <div>
            <div style={{ fontWeight: 600 }}>+$400 earned</div>
            <div style={{ opacity: 0.6, fontSize: 11 }}>Trust Package complete</div>
          </div>
        </div>
        <div className={`${styles.floatCard} ${styles.fc3}`}>
          <div className={styles.floatIc}>★</div>
          <div>
            <div style={{ fontWeight: 600 }}>Complex case flagged</div>
            <div style={{ opacity: 0.6, fontSize: 11 }}>Routed to your inbox</div>
          </div>
        </div>

        <div className={`${styles.container} ${styles.heroInner}`}>
          <div className={styles.heroEyebrow}>
            <span className={styles.pulse} />
            Built with Michigan attorneys
          </div>
          <h1 className={styles.heroTitle}>
            Stop competing
            <br />
            with DIY.
            <br />
            <em>Build your own.</em>
          </h1>
          <p className={styles.heroSub}>
            LegalZoom is taking your clients. EstateVault lets you offer the same automated
            experience  under your name, at your price, with your legal oversight. You become
            the DIY option in your market.
          </p>
          <div className={styles.heroCta}>
            <button onClick={() => scrollTo('pricing')} className={`${styles.btnLg} ${styles.btnGold}`}>
              Choose your plan
              <ArrowRight size={16} />
            </button>
            <button onClick={() => scrollTo('demo')} className={`${styles.btnLg} ${styles.btnGlass}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              Watch the demo
            </button>
          </div>

          <div className={styles.trustBar}>
            {[
              { n: '40+', l: ['Years of combined', 'attorney expertise'] },
              { n: '$400', l: ['Your earnings per', 'trust package sold'] },
              { n: '15min', l: ['Average client', 'intake time'] },
              { n: 'EPIC', l: ['Fully compliant', 'Michigan templates'] },
            ].map((t) => (
              <div key={t.n} className={styles.trustItem}>
                <div className={styles.trustNum}>{t.n}</div>
                <div className={styles.trustLabel}>
                  {t.l[0]}
                  <br />
                  {t.l[1]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ LOGO BAR ============ */}
      {/* <div className={styles.logobar}>
        <div className={styles.container}>
          <div className={styles.logobarLabel}>Trusted by Michigan estate-planning firms</div>
          <div className={styles.logobarRow}>
            <div>Harding &amp; Ross</div>
            <div>Brennan Legal</div>
            <div>Whitfield Law Group</div>
            <div>Vesper &amp; Moore</div>
            <div>Lakeside Estate Law</div>
          </div>
        </div>
      </div>
      {/* </div> */}

      {/* ============ PROBLEM / SOLUTION ============ */}
      <section className={styles.section} id="why">
        <div className={styles.containerSm}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(0)}>
            <span className={styles.sectionEyebrow}>Why attorneys switch</span>
            <h2>The old model is leaving money on the table.</h2>
            <p>
              For every client who drafts a $49 will online, there&apos;s one who would&apos;ve
              paid you $400, if you could deliver it in 15 minutes instead of three office
              visits.
            </p>
          </div>

          <div className={styles.psGrid}>
            <div className={`${styles.psCard} ${styles.psProblem} ${styles.reveal}`} ref={registerReveal(1)}>
              <span className={styles.psTag}>Without EstateVault</span>
              <h3>You lose clients to LegalZoom every day.</h3>
              <ul>
                {[
                  "Paralegal hours you can't bill for basic wills",
                  'Clients who "just need a simple will" go elsewhere',
                  'No way to compete with $49 online templates',
                  'Complex trust work walks in the door… and walks back out',
                  'Your expertise is hidden behind a consult fee',
                ].map((item) => (
                  <li key={item}>
                    <span className={styles.iconX}>✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${styles.psCard} ${styles.psSolution} ${styles.reveal}`} ref={registerReveal(2)}>
              <span className={styles.psTag}>With EstateVault</span>
              <h3>Your firm becomes the DIY option, premium-priced.</h3>
              <ul>
                {[
                  'Clients complete a 15-minute intake, no paralegal time',
                  'Software drafts attorney-grade Michigan documents instantly',
                  'You review, approve, and deliver under your name',
                  'Complex cases flag straight to your engagement pipeline',
                  'Your bar number, your branding, your review fee',
                ].map((item) => (
                  <li key={item}>
                    <span className={styles.iconCheck}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className={`${styles.section} ${styles.howWrap}`} id="how">
        <div className={styles.container}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(3)}>
            <span className={styles.sectionEyebrow}>How it works</span>
            <h2>Your workflow, simplified.</h2>
            <p>Four steps from intake to delivery. No new software to learn. No paralegals reassigned.</p>
          </div>

          <div className={styles.howGrid}>
            <div className={styles.howLine} />
            {[
              { n: 1, t: 'Client completes the intake', d: 'A 15-minute questionnaire covers everything you need. No paralegal time required.' },
              { n: 2, t: 'Software drafts the documents', d: 'Attorney-quality Michigan documents based on EPIC, generated in minutes.' },
              { n: 3, t: 'You review and approve', d: 'Your name, your bar number on delivery. You set your own review fee.' },
              { n: 4, t: 'Complex cases become engagements', d: 'Irrevocable trusts, Medicaid planning, business succession, flagged to you.' },
            ].map((s, i) => (
              <div key={s.n} className={`${styles.howStep} ${styles.reveal}`} ref={registerReveal(4 + i)}>
                <div className={styles.howNum}>{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEMO ============ */}
      <section className={styles.section} id="demo">
        <div className={styles.container}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(8)}>
            <span className={styles.sectionEyebrow}>Client experience</span>
            <h2>See exactly what your clients experience.</h2>
            <p>This is the platform they use, professional, simple, and branded with your firm&apos;s name and logo.</p>
          </div>

          <div className={`${styles.demoStage} ${styles.reveal}`} ref={registerReveal(9)}>
            <div className={styles.demoTabs}>
              {demoTabs.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setDemoTab(i)}
                  className={`${styles.demoTab} ${demoTab === i ? styles.demoTabActive : ''}`}
                >
                  {t.icon}
                  <span className={styles.tn}>{String(i + 1).padStart(2, '0')}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className={styles.device}>
              <div className={styles.deviceChrome}>
                <div className={styles.deviceDots}>
                  <span /><span /><span />
                </div>
                <div className={styles.deviceUrl}>
                  <svg className={styles.lock} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  legacy.yourfirm.com
                </div>
                <div className={styles.deviceActions}>
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 21l-6-6" />
                      <circle cx="10" cy="10" r="7" />
                    </svg>
                  </span>
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="5" cy="12" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className={styles.appTop}>
                <div className={styles.firm}>
                  <div className={styles.firmLogo}>H</div>
                  <div className={styles.firmMeta}>
                    <div className={styles.fn}>Harding &amp; Ross</div>
                    <div className={styles.fs}>Estate Planning · Ann Arbor</div>
                  </div>
                </div>
                <div className={styles.appActions}>
                  <span className={styles.chip}>
                    <span className={styles.dot} />
                    Secure session
                  </span>
                  <div className={styles.appAvatar}>SM</div>
                </div>
              </div>

              <div className={styles.deviceBody}>
                {/* Panel 0, Quiz */}
                <div className={`${styles.panel} ${demoTab === 0 ? styles.panelOn : ''}`}>
                  <div className={styles.panelInner}>
                    <div className={styles.quizShell}>
                      <aside className={styles.quizSide}>
                        <h4>Your progress</h4>
                        <ul className={styles.quizSteps}>
                          <li className="done"><span className={styles.sd}>✓</span>About you</li>
                          <li className="done"><span className={styles.sd}>✓</span>Family</li>
                          <li className="now"><span className={styles.sd}>3</span>Assets</li>
                          <li><span className={styles.sd}>4</span>Beneficiaries</li>
                          <li><span className={styles.sd}>5</span>Guardians</li>
                          <li><span className={styles.sd}>6</span>Review</li>
                        </ul>
                      </aside>

                      <div className={styles.quizMain}>
                        <div className={styles.quizBarRow}>
                          <span className={styles.quizStepTag}>Step 3 / 10</span>
                          <div className={styles.quizBar}><i /></div>
                          <span className={styles.quizPct}>30%</span>
                        </div>
                        <h3 className={styles.quizQ}>Do you own real estate in Michigan?</h3>
                        <p className={styles.quizHelp}>
                          This helps us determine whether a trust may benefit your family by avoiding probate.
                        </p>
                        <div className={styles.quizOpts}>
                          <div className={`${styles.quizOpt} ${styles.quizOptSel}`}>
                            <span className={styles.quizCheckBoxSel}>✓</span>
                            Yes
                            <span className={styles.kbd}>Y</span>
                          </div>
                          <div className={styles.quizOpt}>
                            <span className={styles.quizCheckBox} />
                            No
                            <span className={styles.kbd}>N</span>
                          </div>
                        </div>
                        <div className={styles.quizFoot}>
                          <div className={styles.quizBack}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back
                          </div>
                          <div className={styles.quizNext}>
                            Continue
                            <ArrowRight />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 1, Results */}
                <div className={`${styles.panel} ${demoTab === 1 ? styles.panelOn : ''}`}>
                  <div className={styles.panelInner}>
                    <div className={styles.recWrap}>
                      <div className={styles.recPrimary}>
                        <span className={styles.recTag}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                          </svg>
                          Your match
                        </span>
                        <h3>
                          Based on your answers, a <em>Trust Package</em> fits your situation best.
                        </h3>
                        <p className={styles.recWhy}>
                          Recommended because you own Michigan real estate, have minor children, and value privacy from probate.
                        </p>
                        <ul className={styles.recBullets}>
                          {['Revocable Living Trust', 'Pour-Over Will', 'Durable Power of Attorney', 'Patient Advocate Designation'].map(d => (
                            <li key={d}><Check size={12} />{d}</li>
                          ))}
                        </ul>
                        <div className={styles.recPricebox}>
                          <div>
                            <div className="pl" style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>Trust Package</div>
                            <div className="pv" style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 28, color: '#fff', fontWeight: 500, lineHeight: 1.1, marginTop: 2 }}>$600</div>
                          </div>
                          <ArrowRight size={22} />
                        </div>
                        <div className={styles.recCta}>Get started →</div>
                      </div>

                      <div className={styles.recAlt}>
                        <h4>Other options</h4>
                        <div className={styles.recAltRow}>
                          <div className={styles.recAltCard}>
                            <div>
                              <div className="nm" style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 13, lineHeight: 1.2 }}>Will Package</div>
                              <div className="ds" style={{ fontSize: 11, color: 'var(--charcoal-60)', marginTop: 2 }}>For simpler estates</div>
                            </div>
                            <div className="pr" style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 20, fontWeight: 600, color: 'var(--navy)' }}>$400</div>
                          </div>
                          <div className={styles.recAltCard}>
                            <div>
                              <div className="nm" style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 13, lineHeight: 1.2 }}>+ Attorney Review</div>
                              <div className="ds" style={{ fontSize: 11, color: 'var(--charcoal-60)', marginTop: 2 }}>Reviewed by your firm</div>
                            </div>
                            <div className="pr" style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 20, fontWeight: 600, color: 'var(--navy)' }}>+$300</div>
                          </div>
                        </div>
                        <div className={styles.recTrust}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          Reviewed by Michigan-licensed attorneys at Harding &amp; Ross.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 2, Documents */}
                <div className={`${styles.panel} ${demoTab === 2 ? styles.panelOn : ''}`}>
                  <div className={styles.panelInner}>
                    <div className={styles.docsHero}>
                      <div className={styles.dhIc}><Check size={22} /></div>
                      <div>
                        <div className={styles.dhT}>Your Trust Package is ready.</div>
                        <div className={styles.dhS}>Reviewed &amp; approved by Rachel Harding, Esq. · Apr 17, 2026</div>
                      </div>
                      <div className={styles.dhBadge}>Delivered</div>
                    </div>

                    <div className={styles.docList}>
                      {[
                        { n: 'Revocable Living Trust', p: '32 pages', s: '248 KB' },
                        { n: 'Pour-Over Will', p: '8 pages', s: '62 KB' },
                        { n: 'Durable Power of Attorney', p: '6 pages', s: '48 KB' },
                        { n: 'Patient Advocate Designation', p: '4 pages', s: '36 KB' },
                      ].map((d) => (
                        <div key={d.n} className={styles.docItem}>
                          <div className={styles.docIc}><span className={styles.dx}>PDF</span></div>
                          <div className={styles.docInfo}>
                            <div className={styles.dn}>{d.n}</div>
                            <div className={styles.dm}>
                              {d.p}<span className={styles.sep} />{d.s}<span className={styles.sep} />Updated today
                            </div>
                          </div>
                          <div className={styles.docSig}>Signed</div>
                          <div className={styles.docDl}><DownloadIcon /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel 3, Vault */}
                <div className={`${styles.panel} ${demoTab === 3 ? styles.panelOn : ''}`}>
                  <div className={styles.panelInner}>
                    <div className={styles.vaultHead}>
                      <div className={styles.vt}>
                        <div className={styles.vic}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.vl}>Your Vault</div>
                          <div className={styles.vs}>AES-256 encrypted · PIN protected</div>
                        </div>
                      </div>
                      <div className={styles.vaultPin}>
                        <span className={styles.pinLabel}>Vault PIN</span>
                        <div className={styles.pinDots}>
                          <span /><span /><span /><span />
                        </div>
                      </div>
                    </div>

                    <div className={styles.vaultGrid}>
                      {[
                        { n: 'Estate Documents', c: '4 items', active: true, count: 4 },
                        { n: 'Financial Accounts', c: 'Empty' },
                        { n: 'Insurance Policies', c: 'Empty' },
                        { n: 'Digital Accounts', c: 'Empty' },
                        { n: 'Physical Locations', c: 'Empty' },
                        { n: 'Important Contacts', c: 'Empty' },
                        { n: 'Business Interests', c: 'Empty' },
                        { n: 'Final Wishes', c: 'Empty' },
                      ].map((item, i) => (
                        <div key={item.n} className={`${styles.vaultItem} ${item.active ? styles.vaultItemActive : ''}`}>
                          {item.count ? <span className={styles.vbadge}>{item.count}</span> : null}
                          <div className={styles.vi}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {i === 0 && (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>)}
                              {i === 1 && (<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>)}
                              {i === 2 && (<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />)}
                              {i === 3 && (<><circle cx="8" cy="15" r="4" /><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2" /></>)}
                              {i === 4 && (<><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>)}
                              {i === 5 && (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>)}
                              {i === 6 && (<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>)}
                              {i === 7 && (<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />)}
                            </svg>
                          </div>
                          <div className={styles.vn}>{item.n}</div>
                          <div className={styles.vc}>{item.c}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel 4, Your Review */}
                <div className={`${styles.panel} ${demoTab === 4 ? styles.panelOn : ''}`}>
                  <div className={styles.panelInner}>
                    <div className={styles.revGrid}>
                      <div className={styles.revList}>
                        <div className={styles.revListHead}>
                          <h4>Review Queue</h4>
                          <span className={styles.rct}>3 pending</span>
                        </div>
                        <div className={`${styles.revRow} ${styles.revRowSel}`}>
                          <div className={styles.av}>SM</div>
                          <div>
                            <div className={styles.rn}>Sarah M.</div>
                            <div className={styles.rp}>Trust Package</div>
                          </div>
                          <div className={styles.rt}><span className={styles.urg}>36h</span></div>
                        </div>
                        <div className={styles.revRow}>
                          <div className={styles.av} style={{ background: 'linear-gradient(135deg,#c7d2fe,#818cf8)', color: '#fff' }}>JT</div>
                          <div>
                            <div className={styles.rn}>James T.</div>
                            <div className={styles.rp}>Will Package</div>
                          </div>
                          <div className={styles.rt}>2d</div>
                        </div>
                        <div className={styles.revRow}>
                          <div className={styles.av} style={{ background: 'linear-gradient(135deg,#fecaca,#f87171)', color: '#fff' }}>LP</div>
                          <div>
                            <div className={styles.rn}>Linda P.</div>
                            <div className={styles.rp}>Trust Package</div>
                          </div>
                          <div className={styles.rt}>3d</div>
                        </div>
                      </div>

                      <div className={styles.revDetail}>
                        <div className={styles.revDetailTop}>
                          <div>
                            <div className={styles.rdl}>Sarah M., Revocable Living Trust</div>
                            <div className={styles.rds}>Generated from intake · 32 pages · Ready for attorney review</div>
                          </div>
                          <div className={styles.revSla}>
                            <span className={styles.spdot} />
                            SLA 36h
                          </div>
                        </div>
                        <div className={styles.revPage}>
                          <p><strong>REVOCABLE LIVING TRUST OF <span className={styles.hl}>SARAH M. THOMPSON</span></strong></p>
                          <p>&nbsp;</p>
                          <p>ARTICLE I, DECLARATION OF TRUST</p>
                          <p>I, <span className={styles.hl}>Sarah M. Thompson</span>, of <span className={styles.hl}>Washtenaw County, Michigan</span>, hereby declare this Revocable Living Trust…</p>
                          <p>&nbsp;</p>
                          <p>ARTICLE II, TRUST PROPERTY</p>
                          <p>The Grantor transfers to the Trustee the real property located at <span className={styles.hl}>[intake-derived address]</span>…</p>
                        </div>
                        <div className={styles.revActions}>
                          <div className={`${styles.revBtn} ${styles.revBtnGhost}`}>Request revision</div>
                          <div className={`${styles.revBtn} ${styles.revBtnPrimary}`}>Approve &amp; sign →</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className={`${styles.section} ${styles.priceWrap}`} id="pricing">
        <div className={styles.container}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(10)}>
            <span className={styles.sectionEyebrow}>Pricing</span>
            <h2>Choose your plan.</h2>
            <p>One-time platform fee. No monthly charges. No renewal fees.</p>
          </div>

          <div className={`${styles.promoBox} ${styles.reveal}`} ref={registerReveal(11)}>
            <input
              type="text"
              placeholder="Promotional code"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value); setPromoApplied(false); }}
            />
            <button onClick={() => setPromoApplied(true)}>Apply</button>
          </div>
          <div className={styles.promoMsg}>
            {promoApplied && isPromoValid && (
              <span className={styles.promoOk}>✓ Code applied, platform fee waived!</span>
            )}
            {promoApplied && !isPromoValid && promoCode.trim() !== '' && (
              <span className={styles.promoErr}>Invalid code</span>
            )}
          </div>

          <div className={styles.planGrid}>
            {/* Standard */}
            <div className={`${styles.plan} ${styles.reveal}`} ref={registerReveal(12)}>
              <h3>Standard</h3>
              <p className={styles.planSub}>For solo &amp; small firms</p>
              <div className={styles.planPrice}>
                {promoActive ? (
                  <>
                    <span className={`${styles.planPriceBig} ${styles.planPriceFree}`}>FREE</span>
                    <span className={styles.planPriceCrossed}>$1,200</span>
                  </>
                ) : (
                  <>
                    <span className={styles.planPriceBig}>$1,200</span>
                    <span className={styles.planPriceSmall}>one-time</span>
                  </>
                )}
              </div>
              <p className={styles.planTerms}>3 team seats · Unlimited documents</p>
              <div className={styles.planDivider} />
              <ul>
                {STANDARD_FEATURES.map((f) => (
                  <li key={f}><Check />{f}</li>
                ))}
              </ul>
              <Link
                href={`/partners/attorneys/signup?tier=standard${promoActive ? '&promo=TPFP' : ''}`}
                className={`${styles.planCta} ${styles.planCtaGold}`}
              >
                {promoActive ? 'Get started, Free' : 'Get started'}
              </Link>
            </div>

            {/* Professional */}
            <div className={`${styles.plan} ${styles.planFeatured} ${styles.reveal}`} ref={registerReveal(13)}>
              <span className={styles.planBadge}>Most Popular</span>
              <h3>Professional</h3>
              <p className={styles.planSub}>For growing firms</p>
              <div className={styles.planPrice}>
                {promoActive ? (
                  <>
                    <span className={`${styles.planPriceBig} ${styles.planPriceFree}`}>FREE</span>
                    <span className={styles.planPriceCrossed}>$6,000</span>
                  </>
                ) : (
                  <>
                    <span className={styles.planPriceBig}>$6,000</span>
                    <span className={styles.planPriceSmall}>one-time</span>
                  </>
                )}
              </div>
              <p className={styles.planTerms}>10 team seats · Priority placement</p>
              <div className={styles.planDivider} />
              <ul>
                {PROFESSIONAL_FEATURES.map((f) => (
                  <li key={f.text}><Check />{f.strong ? <strong>{f.text}</strong> : f.text}</li>
                ))}
              </ul>
              <Link
                href={`/partners/attorneys/signup?tier=professional${promoActive ? '&promo=TPFP' : ''}`}
                className={`${styles.planCta} ${styles.planCtaNavy}`}
              >
                {promoActive ? 'Get started, Free' : 'Get started'}
              </Link>
            </div>

            {/* Enterprise */}
            <div className={`${styles.plan} ${styles.reveal}`} ref={registerReveal(14)}>
              <h3>Enterprise</h3>
              <p className={styles.planSub}>For multi-firm operations</p>
              <div className={styles.planPrice}>
                <span className={styles.planPriceBig}>Custom</span>
                <span className={styles.planPriceSmall}>pricing</span>
              </div>
              <p className={styles.planTerms}>Unlimited seats · SLA guarantees</p>
              <div className={styles.planDivider} />
              <ul>
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f.text}><Check />{f.strong ? <strong>{f.text}</strong> : f.text}</li>
                ))}
              </ul>
              <a
                href="mailto:support@estatevault.us?subject=Enterprise%20Attorney%20Partnership%20Inquiry"
                className={`${styles.planCta} ${styles.planCtaOutline}`}
              >
                Talk to sales
              </a>
            </div>
          </div>

          <p className={styles.planNote}>
            All plans include your custom white-label URL: <code>legacy.yourfirm.com</code>
          </p>

          <div className={styles.referral} id="contact-form">
            <div>
              <h3>
                Just want to send and receive referrals? <em>Become a Referral Partner, free.</em>
              </h3>
              <ul>
                <li>Send clients to EstateVault, earn per completion</li>
                <li>Receive flagged complex cases from the platform</li>
                <li>No platform fee, no commitment</li>
                <li>Track referrals from your dashboard</li>
              </ul>
            </div>
            <div className={styles.referralCta}>
              <a href="mailto:support@estatevault.us?subject=Referral%20Partner%20Inquiry">
                Learn more <ArrowRight />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CALCULATOR ============ */}
      <section className={`${styles.section} ${styles.calcWrap}`} id="calculator">
        <div className={styles.containerXs}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(15)}>
            <span className={styles.sectionEyebrow}>Earnings calculator</span>
            <h2>See exactly what you earn.</h2>
            <p>Adjust volume and your review fee. We&apos;ll do the math.</p>
          </div>

          <div className={`${styles.calc} ${styles.reveal}`} ref={registerReveal(16)}>
            <div className={styles.calcToggle}>
              <button
                className={calcTier === 'standard' ? styles.calcToggleOn : ''}
                onClick={() => setCalcTier('standard')}
              >
                Standard, $1,200 one-time
              </button>
              <button
                className={calcTier === 'professional' ? styles.calcToggleOn : ''}
                onClick={() => setCalcTier('professional')}
              >
                Professional, $6,000 one-time
              </button>
            </div>

            <div className={styles.calcBody}>
              <div className={styles.sliderBlock}>
                <div className={styles.sliderHead}>
                  <span className={styles.sliderLabel}>Trust packages / month</span>
                  <span className={styles.sliderVal}>{calcVolume}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={calcVolume}
                  onChange={(e) => setCalcVolume(parseInt(e.target.value, 10))}
                  className={styles.range}
                />
                <div className={styles.sliderScale}><span>1</span><span>30</span></div>
              </div>

              <div className={styles.sliderBlock}>
                <div className={styles.sliderHead}>
                  <span className={styles.sliderLabel}>Your attorney review fee</span>
                  <span className={styles.sliderVal}>${calcReviewFee}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1500}
                  step={25}
                  value={calcReviewFee}
                  onChange={(e) => setCalcReviewFee(parseInt(e.target.value, 10))}
                  className={styles.range}
                />
                <div className={styles.sliderScale}><span>$0</span><span>$1,500</span></div>
                <p className={styles.sliderNote}>Set to $0 if you don&apos;t want to offer attorney review</p>
              </div>
            </div>

            <div className={styles.calcResults}>
              <div className={styles.calcRow}>
                <div>
                  <div className={styles.cl}>Trust Package × {calcVolume} client{calcVolume !== 1 ? 's' : ''}</div>
                  <div className={styles.cs}>${trustSplit} per trust package</div>
                </div>
                <div className={styles.cv}>${trustEarnings.toLocaleString()}</div>
              </div>
              {calcReviewFee > 0 && (
                <div className={`${styles.calcRow} ${styles.calcRowGold}`}>
                  <div>
                    <div className={styles.cl}>Attorney Review × {calcVolume} client{calcVolume !== 1 ? 's' : ''}</div>
                    <div className={styles.cs}>+${calcReviewFee} per client, 100% to you</div>
                  </div>
                  <div className={styles.cv}>+${reviewEarnings.toLocaleString()}</div>
                </div>
              )}
            </div>

            <div className={styles.calcTotal}>
              <div className={styles.tlabel}>Your monthly earnings</div>
              <div className={styles.tnum}>${totalMonthly.toLocaleString()}</div>
              <div className={styles.tper}>/ month</div>
              <div className={styles.tpayback}>
                Your platform pays for itself in {paybackText}.
              </div>
            </div>
          </div>

          <p className={styles.calcDisclaim}>
            Earnings shown are estimates based on your selected volume and review fee. Attorney
            review fees are set by you and must comply with applicable bar rules on
            reasonableness of fees. EstateVault does not set, approve, or regulate attorney
            review fees.
          </p>
        </div>
      </section>

      {/* ============ UPSELL ============ */}
      <section className={`${styles.section} ${styles.upsellWrap}`}>
        <div className={styles.containerSm}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(17)}>
            <span className={styles.sectionEyebrow}>Full engagements</span>
            <h2>
              The cases that need more
              <br />
              come straight to you.
            </h2>
            <p>
              When a client&apos;s situation involves irrevocable trusts, special needs planning,
              Medicaid asset protection, or business succession, the platform flags the case
              and routes it directly to you.
            </p>
          </div>

          <div className={styles.upsellGrid}>
            {[
              { t: 'Irrevocable Trust', p: '$3,500 to $7,500' },
              { t: 'Special Needs Trust', p: '$4,000 to $8,000' },
              { t: 'Medicaid Planning', p: '$5,000 to $10,000' },
            ].map((u, i) => (
              <div key={u.t} className={`${styles.upsellCard} ${styles.reveal}`} ref={registerReveal(18 + i)}>
                <div className={styles.utype}>{u.t}</div>
                <div className={styles.uprice}>{u.p}</div>
                <div className={styles.usub}>avg. engagement fee</div>
              </div>
            ))}
          </div>

          <p className={`${styles.upsellFoot} ${styles.reveal}`} ref={registerReveal(21)}>
            These are not referrals. These are <strong>your clients</strong>, coming to you.
          </p>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className={`${styles.section} ${styles.testimonialsWrap}`}>
        <div className={styles.container}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(22)}>
            <span className={styles.sectionEyebrow}>What attorneys say</span>
            <h2>Built with attorneys. Trusted by firms.</h2>
          </div>

          <div className={styles.tg}>
            {[
              {
                q: 'I used to turn away simple will clients because they weren\'t worth my time. Now they\'re my most profitable 15 minutes of the day. I set my review fee at $350 and the platform did the rest.',
                i: 'RH',
                n: 'Rachel Harding, Esq.',
                r: 'Harding & Ross · Ann Arbor, MI',
              },
              {
                q: 'The complex case routing alone paid for the Professional tier in the first month. I got two Medicaid planning engagements the system flagged during intake. Those were clients I never would have seen otherwise.',
                i: 'MB',
                n: 'Marcus Brennan, Esq.',
                r: 'Brennan Legal · Grand Rapids, MI',
              },
              {
                q: 'My firm\'s name on a branded vault, on my terms, with my bar number. EstateVault isn\'t trying to replace us, it\'s positioning us as the premium DIY option in our market. Exactly what we needed.',
                i: 'JW',
                n: 'Jennifer Whitfield, Esq.',
                r: 'Whitfield Law Group · Detroit, MI',
              },
            ].map((t, i) => (
              <div key={t.i} className={`${styles.tcard} ${styles.reveal}`} ref={registerReveal(23 + i)}>
                <div className={styles.tquote}>&ldquo;</div>
                <div className={styles.tstars}>★★★★★</div>
                <p className={styles.tcopy}>{t.q}</p>
                <div className={styles.tauthor}>
                  <div className={styles.tavatar}>{t.i}</div>
                  <div>
                    <div className={styles.tname}>{t.n}</div>
                    <div className={styles.trole}>{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className={`${styles.section} ${styles.faqWrap}`} id="faq">
        <div className={styles.containerXs}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(26)}>
            <span className={styles.sectionEyebrow}>Frequently asked</span>
            <h2>Questions, answered.</h2>
          </div>

          <div className={`${styles.faq} ${styles.reveal}`} ref={registerReveal(27)}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={item.q} className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}>
                  <button
                    className={styles.faqQ}
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    {item.q}
                    <span className={styles.faqChev} />
                  </button>
                  <div
                    className={styles.faqA}
                    style={{ maxHeight: isOpen ? 400 : 0 }}
                  >
                    <div className={styles.faqAInner}>{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ COMPLIANCE ============ */}
      <section className={styles.compliance}>
        <div className={styles.compInner}>
          <h3>Built with attorneys, for attorneys.</h3>
          <p>
            All document templates were developed in collaboration with Michigan-licensed
            attorneys with over 40 years of combined estate planning experience. You remain the
            professional of record on every engagement. EstateVault is a document preparation
            tool, not a law firm and not a substitute for legal counsel.
          </p>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className={styles.ctaWrap}>
        <div className={styles.containerSm}>
          <h2>
            Become the DIY option
            <br />
            <em>in your market.</em>
          </h2>
          <p>
            Your firm. Your name. Your review fee. Start earning on cases you used to turn away.
          </p>
          <div className={styles.ctaButtons}>
            <button onClick={() => scrollTo('pricing')} className={`${styles.btnLg} ${styles.btnGold}`}>
              Get started now
            </button>
            <a href="mailto:support@estatevault.us" className={`${styles.btnLg} ${styles.btnGlass}`}>
              Talk to sales
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footTop}>
            <div className={styles.footBrand}>
              <Link href="#top" className={styles.brand}>
                <span className={styles.logomark}>
                  <span>E</span>
                </span>
                EstateVault
                <span className={styles.brandTag}>Pro</span>
              </Link>
              <p>
                A B2B2C estate planning platform for attorneys, financial advisors, and
                professional partners.
              </p>
            </div>
            <div className={styles.footCol}>
              <h4>Product</h4>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#calculator">Earnings calculator</a></li>
                <li><a href="#demo">Client experience</a></li>
              </ul>
            </div>
            <div className={styles.footCol}>
              <h4>Partners</h4>
              <ul>
                <li><Link href="/partners/attorneys">Attorneys</Link></li>
                <li><Link href="/partners/attorneys/review-network">Review attorney network</Link></li>
                <li><a href="mailto:support@estatevault.us?subject=Referral%20Partner%20Inquiry">Referral partners</a></li>
              </ul>
            </div>
            <div className={styles.footCol}>
              <h4>Company</h4>
              <ul>
                <li><a href="mailto:support@estatevault.us">Contact</a></li>
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms</Link></li>
                <li><a href="mailto:support@estatevault.us">Security</a></li>
              </ul>
            </div>
          </div>
          <div className={styles.footBot}>
            © 2026 EstateVault Technologies LLC. EstateVault is a document preparation platform.
            Professionals using this platform facilitate document preparation only and do not
            provide legal advice through this platform. Partners are responsible for compliance
            with their state bar&apos;s rules of professional conduct.
          </div>
        </div>
      </footer>
    </div>
  );
}
