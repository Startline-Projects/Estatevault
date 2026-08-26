/**
 * Regression tests for the strict-mode fallback conversion.
 *
 * The point of these is to assert WHICH generation path ran. Before strict
 * mode, an incomplete intake silently fell through to the legacy Claude
 * generator and the client received a document; the failure was invisible.
 * These tests pin that behaviour down in all three modes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_FLAG = process.env.PDF_RENDERER;

/** A trust-package intake with the DPOA agent's name missing. */
function incompleteIntake(): Record<string, unknown> {
  return {
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    executorName: "Raga Hassan",
    executorRelationship: "Spouse",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" }],
    beneficiariesEqualShares: "Yes",
    poaAgentName: "",          // ← required for a DPOA
    poaPowers: [],             // ← required for a DPOA
  };
}

function completeWillIntake(): Record<string, unknown> {
  return {
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    executorName: "Raga Hassan",
    executorRelationship: "Spouse",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "other_beneficiaries" }],
    beneficiariesEqualShares: "Yes",
    hasSpecificGifts: "No",
  };
}

async function freshImport() {
  vi.resetModules();
  return import("./generate-from-template");
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.PDF_RENDERER;
  else process.env.PDF_RENDERER = ORIGINAL_FLAG;
});

describe("flag off — legacy path", () => {
  it("returns null so the caller runs the legacy Claude generator", async () => {
    delete process.env.PDF_RENDERER;
    const { tryTemplateRender } = await freshImport();
    await expect(tryTemplateRender("poa", incompleteIntake())).resolves.toBeNull();
  });
});

describe("react-pdf — staged rollout, fallback still allowed", () => {
  it("falls back to legacy rather than throwing when the intake is incomplete", async () => {
    process.env.PDF_RENDERER = "react-pdf";
    const { tryTemplateRender } = await freshImport();
    await expect(tryTemplateRender("poa", incompleteIntake())).resolves.toBeNull();
  });
});

describe("react-pdf-strict — production path, no silent fallback", () => {
  it("throws TemplateBlockedError instead of falling back", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender, TemplateBlockedError } = await freshImport();

    await expect(tryTemplateRender("poa", incompleteIntake())).rejects.toBeInstanceOf(TemplateBlockedError);
  });

  it("names every missing field on the error so the admin alert is actionable", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender, TemplateBlockedError } = await freshImport();

    try {
      await tryTemplateRender("poa", incompleteIntake());
      throw new Error("expected TemplateBlockedError");
    } catch (e) {
      expect(e).toBeInstanceOf(TemplateBlockedError);
      const err = e as InstanceType<typeof TemplateBlockedError>;
      expect(err.docType).toBe("poa");
      expect(err.reasons).toContain("power of attorney agent");
      expect(err.reasons).toContain("at least one power granted to the agent");
      expect(err.message).toContain("Cannot generate poa");
    }
  });

  it("throws for a document type that has no template rather than silently using Claude", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender, TemplateBlockedError } = await freshImport();
    await expect(tryTemplateRender("funding_instructions", completeWillIntake()))
      .rejects.toBeInstanceOf(TemplateBlockedError);
  });

  it("renders normally when the intake is complete", async () => {
    process.env.PDF_RENDERER = "react-pdf-strict";
    const { tryTemplateRender } = await freshImport();

    const result = await tryTemplateRender("will", completeWillIntake());
    expect(result).not.toBeNull();
    expect(result!.pdfBuffer.length).toBeGreaterThan(1000);
    expect(result!.documentText).toContain("LAST WILL AND TESTAMENT");
    expect(result!.documentText).not.toContain("{{");
  }, 30000);
});
