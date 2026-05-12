/** @type {import('next').NextConfig} */

// Strict CSP for vault routes. Goal: prevent XSS exfil of unlocked vault
// state. Tailwind currently requires 'unsafe-inline' on style-src; tighten
// with nonce in a follow-up.
//
// Deployed in Report-Only mode first. Flip to enforce after report-uri
// shows zero violations for 7+ days. Toggle via env CSP_ENFORCE=1.
const VAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://*.upstash.io https://api.stripe.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join('; ')

const PUBLIC_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join('; ')

const cspHeaderName = process.env.CSP_ENFORCE === '1'
  ? 'Content-Security-Policy'
  : 'Content-Security-Policy-Report-Only'

const baseSecurityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(), payment=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-lib'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/dashboard/:path*',
        headers: [
          ...baseSecurityHeaders,
          { key: cspHeaderName, value: VAULT_CSP },
        ],
      },
      {
        source: '/onboarding/:path*',
        headers: [
          ...baseSecurityHeaders,
          { key: cspHeaderName, value: VAULT_CSP },
        ],
      },
      {
        source: '/recover',
        headers: [
          ...baseSecurityHeaders,
          { key: cspHeaderName, value: VAULT_CSP },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          ...baseSecurityHeaders,
          { key: cspHeaderName, value: PUBLIC_CSP },
        ],
      },
    ]
  },
}

export default nextConfig
