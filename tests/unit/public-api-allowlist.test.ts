/**
 * Every anonymous call the browser can make must target a route middleware lets
 * an anonymous caller reach.
 *
 * Middleware answers 401 for any /api/ path that is not in PUBLIC_PATHS and has
 * no session — before the route handler runs. lib/api-client/ makes a call
 * anonymous by using publicPost, publicGet or postForm. If one of those targets a route
 * that is not public, the page making it can never work for a signed-out
 * visitor, and nothing fails until a real person tries.
 *
 * That is how the emailed password-reset link broke: /auth/reset-password calls
 * /api/auth/exchange-reset-token for someone who, by definition, cannot sign
 * in, and the route was never added to the allowlist. It shipped that way for
 * three months. This test is the check that was missing.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { PUBLIC_PATHS, isPublicPath } from "@/lib/supabase/publicPaths";

const API_CLIENT_DIR = join(__dirname, "..", "..", "lib", "api-client");

type AnonymousCall = { file: string; helper: string; url: string };

// Helpers in lib/api-client/client.ts that send NO session: publicPost and
// publicGet by name, and postForm, which is a bare fetch. (getSoft is left out
// on purpose: it exists to tolerate a 401, e.g. /api/client/quiz-latest.)
const ANONYMOUS_HELPERS = ["publicPost", "publicGet", "postForm"] as const;
const HELPER_RE = new RegExp(`\\b(${ANONYMOUS_HELPERS.join("|")})\\b`, "g");

/**
 * Source with imports and comments removed, so a helper that is merely imported
 * or mentioned in prose is not counted as a call. (A `//` only starts a comment
 * here at the start of a line or after whitespace, which leaves "https://…"
 * inside a string alone.)
 */
function withoutImports(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?[ \t]*$/gm, "");
}

/**
 * Index just past `<...>` type arguments starting at `i`, or `i` if there are
 * none. Counts depth so `publicPost<Result<Array<X>>>(` is handled; a `>` that
 * belongs to `=>` is not a closing bracket.
 */
function skipTypeArgs(src: string, i: number): number {
  if (src[i] !== "<") return i;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "<") depth++;
    else if (src[j] === ">" && src[j - 1] !== "=") { depth--; if (depth === 0) return j + 1; }
  }
  return i;
}

/** Every anonymous call site in lib/api-client, with the static part of its URL. */
function anonymousCalls(): { calls: AnonymousCall[]; unreadable: string[]; mentions: number } {
  const calls: AnonymousCall[] = [];
  const unreadable: string[] = [];
  let mentions = 0;

  for (const file of readdirSync(API_CLIENT_DIR).filter((f) => f.endsWith(".ts"))) {
    if (file === "client.ts") continue; // defines the helpers; calls nothing
    const src = withoutImports(readFileSync(join(API_CLIENT_DIR, file), "utf8"));

    for (const m of Array.from(src.matchAll(HELPER_RE))) {
      mentions++;
      const helper = m[1];
      let i = (m.index ?? 0) + helper.length;
      while (/\s/.test(src[i] ?? "")) i++;
      i = skipTypeArgs(src, i);
      while (/\s/.test(src[i] ?? "")) i++;

      const rest = src.slice(i, i + 200);
      const literal = rest.match(/^\(\s*(["'`])([^"'`$?]*)/);
      if (!literal || !literal[2].startsWith("/")) {
        // Not a call with a readable URL: passed by reference, built from a
        // variable, or a shape this scan does not understand. Fail loudly rather
        // than skip it — skipping is the gap this test exists to close.
        unreadable.push(`${file}: ${helper}${rest.slice(0, 50).replace(/\s+/g, " ")}`);
        continue;
      }
      calls.push({ file, helper, url: literal[2].replace(/\/$/, "") });
    }
  }
  return { calls, unreadable, mentions };
}

describe("anonymous API calls only target public routes", () => {
  const { calls, unreadable, mentions } = anonymousCalls();

  it("finds the call sites (guards against the scan silently matching nothing)", () => {
    expect(calls.length).toBeGreaterThan(20);
    const urls = calls.map((c) => c.url);
    expect(urls).toContain("/api/auth/exchange-reset-token");
    expect(urls).toContain("/api/checkout/will");
    expect(calls.some((c) => c.helper === "postForm"), "postForm call sites are scanned too").toBe(true);
  });

  it("accounts for every mention of an anonymous helper — none is silently skipped", () => {
    // Each mention outside an import is either a call whose URL was read, or is
    // reported as unreadable. A nested generic, a helper passed by reference or
    // any other shape the scan cannot follow therefore fails here.
    expect(calls.length + unreadable.length).toBe(mentions);
  });

  it("no file renames or re-binds an anonymous helper (the scan finds calls by name)", () => {
    for (const file of readdirSync(API_CLIENT_DIR).filter((f) => f.endsWith(".ts") && f !== "client.ts")) {
      const src = readFileSync(join(API_CLIENT_DIR, file), "utf8");
      expect(src, `${file}: import the helper under its own name`).not.toMatch(/\b(publicPost|publicGet|postForm)\s+as\s+\w+/);
      expect(src, `${file}: call the helper directly`).not.toMatch(/=\s*(publicPost|publicGet|postForm)\b(?!\s*[<(])/);
    }
  });

  it("every anonymous call has a URL this test can read", () => {
    expect(unreadable, "use a string literal (or a template literal with a static path) for anonymous calls").toEqual([]);
  });

  it.each(calls.map((c) => [c.url, `${c.file} · ${c.helper}`] as const))(
    "%s is reachable without a session (%s)",
    (url) => {
      expect(
        isPublicPath(url),
        `${url} is called anonymously but is not in PUBLIC_PATHS (lib/supabase/publicPaths.ts), ` +
          "so middleware will answer 401 before the route runs. Either list it there — and make " +
          "sure the handler authenticates itself — or call it with post()/get() instead.",
      ).toBe(true);
    },
  );
});

describe("the password-reset link works for someone who is signed out", () => {
  it("the exchange route is public", () => {
    expect(isPublicPath("/api/auth/exchange-reset-token")).toBe(true);
  });

  it("the page that calls it is public too", () => {
    expect(isPublicPath("/auth/reset-password")).toBe(true);
    expect(isPublicPath("/auth/forgot-password")).toBe(true);
  });

  it("middleware asks this module rather than keeping its own list", () => {
    const middleware = readFileSync(join(__dirname, "..", "..", "lib", "supabase", "middleware.ts"), "utf8");
    expect(middleware).toContain("isPublicPath(pathname)");
    expect(middleware).not.toMatch(/const publicPaths\s*=/);
  });
});

describe("isPublicPath matches whole segments", () => {
  it("a listed prefix covers its children", () => {
    expect(isPublicPath("/api/checkout")).toBe(true);
    expect(isPublicPath("/api/checkout/will")).toBe(true);
    expect(isPublicPath("/api/auth/handoff/consume")).toBe(true);
  });

  it("but not a sibling that merely starts with the same letters", () => {
    expect(isPublicPath("/api/checkoutx")).toBe(false);
    expect(isPublicPath("/api/auth/set-password-admin")).toBe(false);
    expect(isPublicPath("/authx")).toBe(false);
  });

  it("listing one /api/auth route does not open the others", () => {
    expect(isPublicPath("/api/auth")).toBe(false);
    expect(isPublicPath("/api/auth/login-routing")).toBe(false);
    expect(isPublicPath("/api/auth/welcome")).toBe(false);
  });

  it("nothing private slipped in with the refactor", () => {
    for (const p of ["/dashboard", "/pro", "/sales", "/attorney", "/api/vault/items", "/api/partner/me",
      "/api/admin/test-promo", "/api/documents/status", "/api/documents/download", "/api/client/documents"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("has no duplicates and no trailing slashes", () => {
    expect(new Set(PUBLIC_PATHS).size).toBe(PUBLIC_PATHS.length);
    for (const p of PUBLIC_PATHS) expect(p === "/" || !p.endsWith("/"), p).toBe(true);
  });
});
