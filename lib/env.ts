const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]

export function validateEnv() {
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}`)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variables')
    }
  }
}
