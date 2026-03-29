# EstateVault Deployment Checklist
# estatevault.us

## Environment Variables in Vercel
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] STRIPE_CONNECT_CLIENT_ID
- [ ] ANTHROPIC_API_KEY
- [ ] RESEND_API_KEY
- [ ] UPSTASH_REDIS_REST_URL
- [ ] UPSTASH_REDIS_REST_TOKEN
- [ ] NEXT_PUBLIC_SITE_URL=https://www.estatevault.us

## Stripe Live Mode
- [ ] Toggle Stripe Dashboard to Live mode
- [ ] Replace STRIPE_SECRET_KEY with sk_live_ key
- [ ] Replace publishable key with pk_live_ key
- [ ] Create webhook endpoint: https://www.estatevault.us/api/webhooks/stripe
- [ ] Enable event: checkout.session.completed
- [ ] Enable event: transfer.created
- [ ] Replace STRIPE_WEBHOOK_SECRET with live secret
- [ ] Enable Stripe Connect

## Supabase
- [ ] Create documents storage bucket (private)
- [ ] Run database.sql schema
- [ ] Run all migration SQL files
- [ ] Verify RLS policies active

## Resend Email
- [ ] Verify domain estatevault.us in Resend
- [ ] Add DNS records (SPF, DKIM)
- [ ] Test email delivery

## Pre-Launch Smoke Test
- [ ] Landing page loads at estatevault.us
- [ ] Quiz flow complete end to end
- [ ] Will Package purchase with test card
- [ ] Trust Package purchase with test card
- [ ] Documents generate as PDFs
- [ ] Documents upload to Supabase Storage
- [ ] Delivery email arrives
- [ ] Client dashboard shows documents
- [ ] Vault PIN creation works
- [ ] Partner login and onboarding works
- [ ] Sales rep can create partner
- [ ] White-label URL renders partner brand
- [ ] Hard stop for special needs works
- [ ] Mobile responsive on all pages

## Mike's Sign-Off Required
- [ ] All document types reviewed and approved
- [ ] Template version: 1.0.0-michigan
- [ ] Attorney approval date: [TO BE FILLED]
- [ ] Approved By: [TO BE FILLED]
