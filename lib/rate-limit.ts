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

// Trustee OTP resend — a new code resets the per-code attempt counter, so cap
// resends to stop unlimited fresh guess batches (H-4). Keyed per request id.
export const trusteeOtpResendRateLimit = makeLimiter('rl:trustee:otp', Ratelimit.slidingWindow(3, '1 h'))
