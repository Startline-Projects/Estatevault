import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const upstashConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const redis = upstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

type Limiter = { limit: (key: string) => Promise<{ success: boolean }> }

function makeLimiter(prefix: string, limiter: ConstructorParameters<typeof Ratelimit>[0]['limiter']): Limiter {
  if (!redis) {
    // No Upstash configured (e.g. local dev) — allow all.
    return { limit: async () => ({ success: true }) }
  }
  return new Ratelimit({ redis, limiter, prefix })
}

export const authRateLimit = makeLimiter('rl:auth', Ratelimit.slidingWindow(5, '1 m'))

// Auth limits keyed only on the target email let one attacker work many
// accounts in parallel, each under its own budget. This second dimension caps
// what a single source address can attempt across ALL accounts. Deliberately
// looser than the per-email limit so a shared office NAT is not locked out by
// one colleague's typo.
export const authIpRateLimit = makeLimiter('rl:auth:ip', Ratelimit.slidingWindow(30, '1 m'))

// Password-reset requests. /api/auth/recovery had no limit at all: it mails a
// reset link to any address supplied, so an unlimited caller could use it to
// bomb a victim's inbox or to farm the platform's mail reputation.
export const recoveryRateLimit = makeLimiter('rl:auth:recovery', Ratelimit.slidingWindow(3, '15 m'))
export const checkoutRateLimit = makeLimiter('rl:checkout', Ratelimit.slidingWindow(10, '1 m'))
export const apiRateLimit = makeLimiter('rl:api', Ratelimit.slidingWindow(100, '1 m'))

// E2EE crypto endpoints — slow brute force on wrapped MK material.
export const cryptoBundleRateLimit = makeLimiter('rl:crypto:bundle', Ratelimit.slidingWindow(10, '1 m'))
export const cryptoRecoveryRateLimit = makeLimiter('rl:crypto:recovery', Ratelimit.slidingWindow(3, '1 m'))
// M-5: 1/hour hard-locked a new user out of vault setup if their single attempt
// failed (bad payload, transient error). 5/hour leaves brute-force protection
// intact (bootstrap is auth-gated + the route 409s once crypto_setup_at is set)
// while letting a genuine retry through.
export const cryptoBootstrapRateLimit = makeLimiter('rl:crypto:bootstrap', Ratelimit.slidingWindow(5, '1 h'))
export const cryptoRotateRateLimit = makeLimiter('rl:crypto:rotate', Ratelimit.slidingWindow(5, '1 h'))

// Vault PIN verify/change — 6-digit PIN is brute-forceable without a lockout.
// 5 attempts per 15 min = ~2000 days to exhaust 1M combos. Keyed per user id.
export const vaultPinRateLimit = makeLimiter('rl:vault:pin', Ratelimit.slidingWindow(5, '15 m'))

// Email verification — global verify attempt cap per email (BUG-38).
// 10 attempts / 15 min regardless of resends = ~2.8 years to exhaust 1M combos.
export const emailVerifyRateLimit = makeLimiter('rl:email:verify', Ratelimit.slidingWindow(10, '15 m'))
// Email verification — resend cap per email (BUG-38). Mirrors trustee OTP.
export const emailResendRateLimit = makeLimiter('rl:email:resend', Ratelimit.slidingWindow(3, '1 h'))
// Email verification — IP-level spray cap (BUG-38). Loose to avoid shared-NAT issues.
export const emailVerifyIpRateLimit = makeLimiter('rl:email:verify:ip', Ratelimit.slidingWindow(30, '15 m'))

// check-email endpoint — prevent bulk enumeration (BUG-39).
export const checkEmailIpRateLimit = makeLimiter('rl:check-email:ip', Ratelimit.slidingWindow(10, '1 m'))
export const checkEmailTargetRateLimit = makeLimiter('rl:check-email:target', Ratelimit.slidingWindow(5, '5 m'))

// Trustee OTP resend — a new code resets the per-code attempt counter, so cap
// resends to stop unlimited fresh guess batches (H-4). Keyed per request id.
export const trusteeOtpResendRateLimit = makeLimiter('rl:trustee:otp', Ratelimit.slidingWindow(3, '1 h'))


/**
 * The caller's IP, as far as the platform can tell. Vercel sets
 * x-forwarded-for; the leftmost entry is the client. Falls back to a single
 * shared bucket when there is no header, which fails closed-ish: unknown
 * callers share one budget rather than each getting their own.
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}
