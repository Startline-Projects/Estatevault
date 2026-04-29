import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any })

export function calculateSplit(
  productType: string,
  partnerTier: 'standard' | 'enterprise',
  opts?: { affiliate?: boolean }
): { evCut: number; partnerCut: number; affiliateCut: number } {
  // Affiliate path (no partner involved): direct main-site sale referred by affiliate
  if (opts?.affiliate) {
    const affiliateSplits: Record<string, { ev: number; affiliate: number }> = {
      will: { ev: 30000, affiliate: 10000 },   // $300 EV / $100 affiliate
      trust: { ev: 40000, affiliate: 20000 },  // $400 EV / $200 affiliate
      amendment: { ev: 5000, affiliate: 0 },
      attorney_review: { ev: 0, affiliate: 0 },
    }
    const a = affiliateSplits[productType]
    if (!a) return { evCut: 0, partnerCut: 0, affiliateCut: 0 }
    return { evCut: a.ev, partnerCut: 0, affiliateCut: a.affiliate }
  }

  const splits: Record<string, Record<string, { ev: number; partner: number }>> = {
    will: {
      standard: { ev: 10000, partner: 30000 },
      enterprise: { ev: 5000, partner: 35000 },
    },
    trust: {
      standard: { ev: 20000, partner: 40000 },
      enterprise: { ev: 15000, partner: 45000 },
    },
    amendment: {
      standard: { ev: 1500, partner: 3500 },
      enterprise: { ev: 1000, partner: 4000 },
    },
    attorney_review: {
      standard: { ev: 0, partner: 0 },
      enterprise: { ev: 0, partner: 0 },
    },
  }
  const split = splits[productType]?.[partnerTier]
  if (!split) return { evCut: 0, partnerCut: 0, affiliateCut: 0 }
  return { evCut: split.ev, partnerCut: split.partner, affiliateCut: 0 }
}

export async function transferToPartner(
  partnerStripeAccountId: string,
  amount: number,
  orderId: string,
  partnerId: string,
  productType: string
) {
  if (!partnerStripeAccountId || amount <= 0) return null
  const transfer = await stripe.transfers.create({
    amount,
    currency: 'usd',
    destination: partnerStripeAccountId,
    transfer_group: orderId,
    metadata: { order_id: orderId, partner_id: partnerId, product_type: productType },
  })
  return transfer
}

export async function transferToAffiliate(
  affiliateStripeAccountId: string,
  amount: number,
  orderId: string,
  affiliateId: string,
  productType: string
) {
  if (!affiliateStripeAccountId || amount <= 0) return null
  const transfer = await stripe.transfers.create({
    amount,
    currency: 'usd',
    destination: affiliateStripeAccountId,
    transfer_group: orderId,
    metadata: { order_id: orderId, affiliate_id: affiliateId, product_type: productType },
  })
  return transfer
}

export async function createAffiliateConnectAccount(email: string, affiliateId: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email,
    capabilities: { transfers: { requested: true } },
    metadata: { affiliate_id: affiliateId },
  })
  return account
}

export async function createAffiliateAccountLink(accountId: string, baseUrl: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/affiliate-signup?step=stripe`,
    return_url: `${baseUrl}/api/affiliate/onboarding/callback?account=${accountId}`,
    type: 'account_onboarding',
  })
  return accountLink
}

export async function createStripeConnectAccount(email: string, partnerId: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email,
    capabilities: { transfers: { requested: true } },
    metadata: { partner_id: partnerId },
  })
  return account
}

export async function createAccountLink(accountId: string, baseUrl: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/pro/onboarding/step-6`,
    return_url: `${baseUrl}/pro/onboarding/step-6?connected=true`,
    type: 'account_onboarding',
  })
  return accountLink
}

export async function getAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId)
  return {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
  }
}
