'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './khan-lawgroup.module.css';

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
  const [calcProduct, setCalcProduct] = useState<'trust' | 'will'>('trust');
  const [calcVolume, setCalcVolume] = useState(5);
  const [calcReviewFee, setCalcReviewFee] = useState(300);
  const [demoTab, setDemoTab] = useState(0);
  const [demoLoading, setDemoLoading] = useState(false);
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

  const productSplit =
    calcProduct === 'trust'
      ? calcTier === 'standard' ? 400 : 500
      : calcTier === 'standard' ? 300 : 350;
  const platformFee = promoActive ? 0 : calcTier === 'standard' ? 1200 : 6000;
  const productEarnings = productSplit * calcVolume;
  const reviewEarnings = calcReviewFee > 0 ? calcReviewFee * calcVolume : 0;
  const totalMonthly = productEarnings + reviewEarnings;
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
      label: 'Client view',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: 'Your view',
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
            <img src="/logo.svg" alt="EstateVault" className={styles.brandLogo} />
            <span className={styles.brandName}>EstateVault</span>
          </Link>
          <nav className={styles.navLinks}>
            <a href="#how">How it works</a>
            <a href="#demo">Client experience</a>
            <a href="#pricing">Pricing</a>
            <a href="#calculator">Earnings</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={styles.navCta}>
            <a
              href="https://khan-lawgroup.com/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.khanMark}
              aria-label="Khan Law Group, PC"
            >
              <span className={styles.khanMarkName}>Khan Law Group</span>
              <span className={styles.khanMarkPc}>PC</span>
            </a>
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
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className={styles.hero} id="top">
        <div className={styles.heroFade} />
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
            Your clients already trust Khan Law Group. Now offer them that same trusted counsel
            for estate planning, attorney-grade wills and trusts under your name, your bar
            number, and your review fee.
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
              { n: '$300', l: ['Your earnings per', 'will package sold'] },
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
              <div className={styles.productToggle}>
                <button
                  className={calcProduct === 'trust' ? styles.productToggleOn : ''}
                  onClick={() => setCalcProduct('trust')}
                >
                  Trust Package
                </button>
                <button
                  className={calcProduct === 'will' ? styles.productToggleOn : ''}
                  onClick={() => setCalcProduct('will')}
                >
                  Will Package
                </button>
              </div>

              <div className={styles.sliderBlock}>
                <div className={styles.sliderHead}>
                  <span className={styles.sliderLabel}>{calcProduct === 'trust' ? 'Trust' : 'Will'} packages / month</span>
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
                  <div className={styles.cl}>{calcProduct === 'trust' ? 'Trust' : 'Will'} Package × {calcVolume} client{calcVolume !== 1 ? 's' : ''}</div>
                  <div className={styles.cs}>${productSplit} per {calcProduct} package</div>
                </div>
                <div className={styles.cv}>${productEarnings.toLocaleString()}</div>
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
      {/* ============ DEMO ============ */}
      <section className={styles.section} id="demo">
        <div className={styles.container}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} ref={registerReveal(8)}>
            <span className={styles.sectionEyebrow}>Client experience</span>
            <h2>See exactly what your clients experience and what you experience.</h2>
            <p>This is the platform they use — and what you experience managing it — professional, simple, and branded with your firm&apos;s name and logo.</p>
          </div>
          <div className={`${styles.demoStage} ${styles.reveal}`} ref={registerReveal(9)}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
            <div className={styles.demoTabs}>
              {demoTabs.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => { if (i !== demoTab) { setDemoTab(i); setDemoLoading(true); } }}
                  className={`${styles.demoTab} ${demoTab === i ? styles.demoTabActive : ''}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
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
                  khan-lawgroup.com
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

              <div className={styles.deviceBody} style={{ position: 'relative' }}>
                {/* Loading skeleton overlay */}
                {demoLoading && (
                  <div className={styles.iframeSkeleton}>
                    <div className={styles.skeletonBar} style={{ width: '40%', height: 16, marginBottom: 20 }} />
                    <div className={styles.skeletonBar} style={{ width: '100%', height: 48, marginBottom: 12 }} />
                    <div className={styles.skeletonBar} style={{ width: '100%', height: 48, marginBottom: 12 }} />
                    <div className={styles.skeletonBar} style={{ width: '100%', height: 48, marginBottom: 12 }} />
                    <div className={styles.skeletonBar} style={{ width: '60%', height: 14, marginTop: 8 }} />
                  </div>
                )}

                {/* Client view — full interactive dashboard in iframe */}
                {demoTab === 0 && (
                  <iframe
                    src="/khan-lawgroup/dashboard"
                    className={styles.demoIframe}
                    style={{ opacity: demoLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
                    title="Client dashboard demo"
                    onLoad={() => setDemoLoading(false)}
                  />
                )}

                {/* Your view — attorney review queue */}
                {demoTab === 1 && (
                  <iframe
                    src="/khan-lawgroup/attorney"
                    className={styles.demoIframe}
                    style={{ opacity: demoLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
                    title="Attorney review queue demo"
                    onLoad={() => setDemoLoading(false)}
                  />
                )}
              </div>
            </div>
          </div>
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
            All plans include your custom white-label URL: <code>khan-lawgroup.com</code>
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
                <img src="/logo.svg" alt="EstateVault" className={styles.brandLogo} />
                <span className={styles.brandName}>EstateVault</span>
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
