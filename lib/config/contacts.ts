// Platform contacts that code depends on. One place — nothing else may spell
// these addresses out (tests/unit/contacts.test.ts enforces that).
//
// Two things follow from an address here being wrong, and both are silent at
// the point of failure:
//  - mail is sent to it, so a typo means nobody is told;
//  - the Stripe webhook turns it into a PROFILE ID by lookup, so an account
//    must exist under exactly this address in every environment, or a paid
//    attorney review is recorded with no reviewer / no controlling admin
//    (handleAttorneyReview logs an error naming the address when that happens).
//
// The seed migration supabase/migrations/20260401_001_seed_mo_review_attorney.sql
// has to repeat the admin address (SQL cannot import this file); the test keeps
// the two in step.

/**
 * The platform admin. Receives fulfilment-failure alerts (lib/email.ts) and is
 * recorded as fee_controlled_by on every paid attorney review.
 */
export const PLATFORM_ADMIN_EMAIL = "info@estatevault.us";

/**
 * Who a paid attorney review is assigned to (attorney_reviews.attorney_id).
 *
 * PILOT RELAY — this is the founder's inbox, not an attorney's, so that every
 * paid review during the pilot lands where a person will see it. Post-pilot,
 * change it to the reviewing attorney's own address (the in-house attorney the
 * seed migration above describes), and create or re-point that account in
 * every environment BEFORE the change deploys.
 */
export const REVIEW_ATTORNEY_EMAIL = "ahm3dkass@gmail.com";
