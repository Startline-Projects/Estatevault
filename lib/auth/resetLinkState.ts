/**
 * What /auth/reset-password should show, decided in one place so it can be
 * tested without rendering the page.
 *
 * The emailed link is single-use. The page exchanges it once for a recovery
 * session, and everything after that — a reload, a second click on the same
 * email — has to be told apart from a link that is genuinely dead.
 */

export type ResetLinkView =
  /** A recovery session exists: show the form, enabled. */
  | { kind: "ready" }
  /** The link was spent somewhere else: show the "Link Already Used" screen. */
  | { kind: "linkUsed" }
  /** The link is invalid or expired: a new one is needed. */
  | { kind: "deadLink" }
  /** Nothing is wrong with the link; the attempt failed. Reloading may work. */
  | { kind: "retry"; message: string }
  /** No link and nothing to recover: the form stays disabled. */
  | { kind: "idle" };

export const RESET_DEAD_LINK_MESSAGE =
  "This reset link is invalid or has expired. Please request a new one.";
export const RESET_RETRY_MESSAGE =
  "Something went wrong. Please reload this page to try again.";

/** sessionStorage key set when THIS TAB exchanged a link successfully. */
export const RESET_EXCHANGED_MARKER = "ev_reset_exchanged";

export type ExchangeOutcome = { ok: true } | { ok: false; error: string };

export function decideResetLinkView(input: {
  /** The URL carries token_hash + type=recovery. */
  hasToken: boolean;
  /** Result of the exchange call; null when there was no token to exchange. */
  exchange: ExchangeOutcome | null;
  /** This tab exchanged a link successfully earlier (the marker is present). */
  exchangedInThisTab: boolean;
  /** The browser holds a Supabase session. */
  hasSession: boolean;
}): ResetLinkView {
  const { hasToken, exchange, exchangedInThisTab, hasSession } = input;

  // A session only counts when this tab is the one that earned it. Any signed-in
  // session would otherwise turn this page into "change the password of whoever
  // is logged in here", with no link and no mailbox step involved.
  const recovered = exchangedInThisTab && hasSession;

  if (!hasToken || !exchange) return recovered ? { kind: "ready" } : { kind: "idle" };
  if (exchange.ok) return { kind: "ready" };

  switch (exchange.error) {
    case "link_already_used":
      return recovered ? { kind: "ready" } : { kind: "linkUsed" };
    case "invalid_or_expired_link":
    case "invalid payload":
      // A second visit from the tab that spent the link still has its session,
      // whether or not the server kept a record of the first visit.
      return recovered ? { kind: "ready" } : { kind: "deadLink" };
    default:
      // Rate limit, server error, network: says nothing about the link. Only the
      // route's own rate-limit sentence is shown as written; anything else gets
      // the generic line rather than a raw server string such as "internal error".
      return {
        kind: "retry",
        message: exchange.error.startsWith("Too many attempts") ? exchange.error : RESET_RETRY_MESSAGE,
      };
  }
}
