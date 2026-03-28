import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any })

export function calculateSplit(
  productType: string,
  partnerTier: 'standard' | 'enterprise'
): { evCut: number; partnerCut: number } {
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
  if (!split) return { evCut: 0, partnerCut: 0 }
  return { evCut: split.ev, partnerCut: split.partner }
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
