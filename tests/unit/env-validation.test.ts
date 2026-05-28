import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEnv } from "@/lib/env";

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

describe("validateEnv", () => {
  let origEnv: Record<string, string | undefined>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    origEnv = {};
    REQUIRED_KEYS.forEach((k) => {
      origEnv[k] = process.env[k];
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    REQUIRED_KEYS.forEach((k) => {
      if (origEnv[k] === undefined) delete process.env[k];
      else process.env[k] = origEnv[k];
    });
    consoleErrorSpy.mockRestore();
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  });

  it("does not throw in dev when vars are missing", () => {
    REQUIRED_KEYS.forEach((k) => delete process.env[k]);
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    expect(() => validateEnv()).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("throws in production when vars are missing", () => {
    REQUIRED_KEYS.forEach((k) => delete process.env[k]);
    (process.env as Record<string, string | undefined>).NODE_ENV ="production";
    expect(() => validateEnv()).toThrow("Missing required environment variables");
  });

  it("does not log when all vars are present", () => {
    REQUIRED_KEYS.forEach((k) => { process.env[k] = "test-value"; });
    (process.env as Record<string, string | undefined>).NODE_ENV ="production";
    expect(() => validateEnv()).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("lists missing vars in error message", () => {
    REQUIRED_KEYS.forEach((k) => delete process.env[k]);
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    validateEnv();
    const msg = consoleErrorSpy.mock.calls[0][0] as string;
    expect(msg).toContain("STRIPE_SECRET_KEY");
    expect(msg).toContain("ANTHROPIC_API_KEY");
  });

  it("passes when only some vars are missing in dev", () => {
    REQUIRED_KEYS.forEach((k) => { process.env[k] = "val"; });
    delete process.env.RESEND_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    validateEnv();
    const msg = consoleErrorSpy.mock.calls[0][0] as string;
    expect(msg).toContain("RESEND_API_KEY");
    expect(msg).not.toContain("STRIPE_SECRET_KEY");
  });
});
