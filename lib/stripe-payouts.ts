import { stripe } from './stripe'
import { PARTNER_SPLITS, AFFILIATE_SPLITS } from './orders/pricing'

export function calculateSplit(
  productType: string,
  partnerTier: 'standard' | 'enterprise',
  opts?: { affiliate?: boolean }
): { evCut: number; partnerCut: number; affiliateCut: number } {
  if (opts?.affiliate) {
    const a = AFFILIATE_SPLITS[productType]
    if (!a) return { evCut: 0, partnerCut: 0, affiliateCut: 0 }
    return { evCut: a.ev, partnerCut: 0, affiliateCut: a.affiliate }
  }

  const split = PARTNER_SPLITS[productType]?.[partnerTier]
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

export async function transferToAffiliateBatch(
  affiliateStripeAccountId: string,
  amount: number,
  affiliateId: string,
  orderIds: string[]
) {
  if (!affiliateStripeAccountId || amount <= 0) return null
  const transfer = await stripe.transfers.create({
    amount,
    currency: 'usd',
    destination: affiliateStripeAccountId,
    metadata: {
      affiliate_id: affiliateId,
      payout_type: 'affiliate_batch',
      order_count: String(orderIds.length),
    },
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
