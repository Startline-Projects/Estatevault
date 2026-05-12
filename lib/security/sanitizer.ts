"use client";

// Minimal Trusted Types policy + safe HTML helper. Use ANY time vault routes
// need to set innerHTML/outerHTML or render server-supplied strings as HTML.
//
// Policy creation is idempotent. Safari (no TT support) → falls back to
// returning the raw string; CSP `require-trusted-types-for 'script'` will
// still block, so callers should prefer textContent in vault routes.

type TrustedTypePolicy = {
  createHTML: (input: string) => string;
};

let policy: TrustedTypePolicy | null = null;

function getPolicy(): TrustedTypePolicy {
  if (policy) return policy;
  const w = typeof window !== "undefined" ? (window as unknown as {
    trustedTypes?: { createPolicy: (n: string, opts: { createHTML: (s: string) => string }) => TrustedTypePolicy };
  }) : null;

  if (w?.trustedTypes?.createPolicy) {
    policy = w.trustedTypes.createPolicy("ev-sanitize", {
      createHTML: (s: string) => stripDangerous(s),
    });
  } else {
    policy = { createHTML: (s: string) => stripDangerous(s) };
  }
  return policy!;
}

const DANGEROUS = /<\s*(script|iframe|object|embed|link|meta)\b[^>]*>/gi;
const ON_HANDLERS = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi;

function stripDangerous(s: string): string {
  return s.replace(DANGEROUS, "").replace(ON_HANDLERS, "").replace(JS_URLS, "");
}

export function sanitizeHtml(input: string): string {
  return getPolicy().createHTML(input);
}

// Prefer this in vault routes — sets textContent, never parses HTML.
export function setTextSafe(el: HTMLElement, value: string): void {
  el.textContent = value;
}
