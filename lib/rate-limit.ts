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
export const cryptoBootstrapRateLimit = makeLimiter('rl:crypto:bootstrap', Ratelimit.slidingWindow(1, '1 h'))
export const cryptoRotateRateLimit = makeLimiter('rl:crypto:rotate', Ratelimit.slidingWindow(5, '1 h'))
