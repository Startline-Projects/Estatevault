/**
 * Every state /auth/reset-password can be in, and what the person sees.
 *
 * The page's decision is a pure function so it can be pinned here. Two things it
 * must never do: tell someone a good link is dead because the server was busy,
 * and let "there is a session in this browser" stand in for "this person used
 * their reset link here".
 */

import { describe, it, expect } from "vitest";
import {
  decideResetLinkView,
  RESET_RETRY_MESSAGE,
  type ExchangeOutcome,
} from "@/lib/auth/resetLinkState";

const fail = (error: string): ExchangeOutcome => ({ ok: false, error });
const base = { hasToken: true, exchangedInThisTab: false, hasSession: false };

describe("with a link in the URL", () => {
  it("a good link → the form", () => {
    expect(decideResetLinkView({ ...base, exchange: { ok: true } })).toEqual({ kind: "ready" });
  });

  it("an invalid or expired link → dead link", () => {
    expect(decideResetLinkView({ ...base, exchange: fail("invalid_or_expired_link") })).toEqual({ kind: "deadLink" });
    expect(decideResetLinkView({ ...base, exchange: fail("invalid payload") })).toEqual({ kind: "deadLink" });
  });

  it("a link spent elsewhere → 'Link Already Used'", () => {
    expect(decideResetLinkView({ ...base, exchange: fail("link_already_used") })).toEqual({ kind: "linkUsed" });
  });

  it("a rate limit says nothing about the link: show the route's own sentence, keep the link", () => {
    expect(decideResetLinkView({ ...base, exchange: fail("Too many attempts. Please wait and try again.") }))
      .toEqual({ kind: "retry", message: "Too many attempts. Please wait and try again." });
  });

  it.each(["internal error", "Request failed", "", "Something went wrong. Please reload this page to try again."])(
    "a server error (%j) → retry, and never a raw server string",
    (error) => {
      expect(decideResetLinkView({ ...base, exchange: fail(error) })).toEqual({ kind: "retry", message: RESET_RETRY_MESSAGE });
    },
  );
});

describe("coming back in the tab that already used the link", () => {
  const here = { hasToken: true, exchangedInThisTab: true, hasSession: true };

  it("the server remembers the first visit → the form, not 'already used'", () => {
    expect(decideResetLinkView({ ...here, exchange: fail("link_already_used") })).toEqual({ kind: "ready" });
  });

  it("the server kept no record of it → still the form", () => {
    expect(decideResetLinkView({ ...here, exchange: fail("invalid_or_expired_link") })).toEqual({ kind: "ready" });
  });

  it("a reload after the token was dropped from the URL → the form", () => {
    expect(decideResetLinkView({ hasToken: false, exchange: null, exchangedInThisTab: true, hasSession: true }))
      .toEqual({ kind: "ready" });
  });

  it("but if the session has gone, the marker alone is not enough", () => {
    expect(decideResetLinkView({ hasToken: false, exchange: null, exchangedInThisTab: true, hasSession: false }))
      .toEqual({ kind: "idle" });
    expect(decideResetLinkView({ hasToken: true, exchange: fail("link_already_used"), exchangedInThisTab: true, hasSession: false }))
      .toEqual({ kind: "linkUsed" });
  });
});

describe("a session that this tab did not earn through a reset link unlocks nothing", () => {
  // Otherwise the page becomes "change the password of whoever is signed in on
  // this computer", with no link and no mailbox involved.
  const signedInElsewhere = { exchangedInThisTab: false, hasSession: true };

  it("no link at all", () => {
    expect(decideResetLinkView({ hasToken: false, exchange: null, ...signedInElsewhere })).toEqual({ kind: "idle" });
  });

  it("someone else's spent link", () => {
    expect(decideResetLinkView({ hasToken: true, exchange: fail("link_already_used"), ...signedInElsewhere }))
      .toEqual({ kind: "linkUsed" });
  });

  it("a dead link", () => {
    expect(decideResetLinkView({ hasToken: true, exchange: fail("invalid_or_expired_link"), ...signedInElsewhere }))
      .toEqual({ kind: "deadLink" });
  });
});

describe("the page uses this, and only this, to decide", () => {
  it("is wired in", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const page = readFileSync(join(__dirname, "..", "..", "app", "auth", "reset-password", "page.tsx"), "utf8");
    expect(page).toContain("decideResetLinkView(");
    expect(page).toContain("RESET_EXCHANGED_MARKER");
    expect(page).toContain("window.history.replaceState");
    expect(page).toMatch(/bootstrap\(\)\.catch\(/);
    expect(page).toMatch(/if \(exchanged\.current\) return;/);
  });
});
