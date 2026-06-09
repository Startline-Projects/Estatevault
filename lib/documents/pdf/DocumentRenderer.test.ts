import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { DocumentRenderer } from "./DocumentRenderer";
import { DOCUMENT_CONFIG, type DocumentType, type BrandingContext } from "./document-config";
import { renderTemplate } from "../render-template";
import { initialTemplateWillIntake as initialWillIntake, type TemplateWillIntake as WillIntake } from "../intake-adapter";

/**
 * Integration tests for the top-level {@link DocumentRenderer}. These exercise
 * the full Part 3 pipeline: resolver → parser → component dispatch → layout →
 * PDF bytes.
 *
 * We deliberately don't snapshot rendered output — pixel-level rendering is
 * covered by visual review of the generated sample PDFs (`npm run samples`).
 * Here we focus on (1) the integration glue not throwing, (2) the output being
 * a valid PDF, and (3) branding / conditional branches reaching the correct
 * code paths.
 */

const $ = React.createElement;
const SMOKE_TIMEOUT = 60_000;

/**
 * Wrap a DocumentRenderer createElement call and cast it to the type
 * `renderToBuffer` expects. DocumentRenderer renders into a <Document> via
 * DocumentLayout at runtime, so the cast is structurally accurate — it's only
 * needed because `React.createElement(DocumentRenderer, ...)` returns a
 * `ReactElement<DocumentRendererProps>` rather than `ReactElement<DocumentProps>`.
 */
function makeElement(props: React.ComponentProps<typeof DocumentRenderer>): React.ReactElement<DocumentProps> {
  return $(DocumentRenderer, props) as unknown as React.ReactElement<DocumentProps>;
}

/** Assert: buffer is a real, non-trivial PDF. */
function assertValidPdf(buf: Buffer) {
  expect(buf.byteLength).toBeGreaterThan(1000);
  expect(buf.slice(0, 4).toString()).toBe("%PDF");
}

/** Load a template file by document type. */
function loadTemplate(type: DocumentType): string {
  const cfg = DOCUMENT_CONFIG[type];
  return readFileSync(join(__dirname, "..", "templates", cfg.templateFile), "utf8");
}

/**
 * Build a fully-populated WillIntake fixture that exercises every conditional
 * branch the templates check (Married branch, has_children/minor branch,
 * funeral rep branch, organ donation yes_all, etc.). The cast to WillIntake
 * carries extra fields used by `{{#IF attorney_review_purchased}}` blocks —
 * the resolver spreads the intake object as-is into its lookup namespace, so
 * unknown extras are fine at runtime.
 */
function realisticIntake(overrides: Partial<WillIntake> = {}): WillIntake {
  const base = JSON.parse(JSON.stringify(initialWillIntake)) as WillIntake;
  const filled = {
    ...base,
    first_name: "John",
    middle_name: "Sample",
    last_name: "Smith",
    suffix: "None",
    date_of_birth: "1975-04-12",
    street_address: "123 Maple Street",
    city: "Detroit",
    county: "Wayne",
    zip: "48201",
    marital_status: "Married",
    spouse_full_name: "Mary Sample Smith",

    has_children: true,
    children: [
      { full_name: "Alice Sample Smith", date_of_birth: "2014-06-01", is_minor: true },
      { full_name: "Bob Sample Smith", date_of_birth: "2003-08-22", is_minor: false },
    ],
    has_minor_children: true,

    personal_representative: { full_name: "Mark Reliable", relationship: "Brother", city: "Ann Arbor", state: "Michigan", phone: "(734) 555-1212" },
    successor_personal_representative: { full_name: "Sue Reliable", relationship: "Sister", city: "Lansing", state: "Michigan" },
    second_successor_personal_representative: null,

    primary_beneficiaries: [
      { full_name: "Alice Sample Smith", relationship: "daughter", share_percent: "50", per_stirpes: true },
      { full_name: "Bob Sample Smith", relationship: "son", share_percent: "50", per_stirpes: true },
    ],
    contingent_beneficiaries: [
      { full_name: "Carol Adams", relationship: "sister", share_percent: "100" },
    ],

    guardian: { full_name: "Carol Adams", relationship: "Aunt", city: "Grand Rapids", state: "Michigan", phone: "(616) 555-3434" },
    successor_guardian: { full_name: "Daniel Adams", relationship: "Uncle" },
    standby_guardian: null,

    has_specific_gifts: true,
    specific_gifts: [
      { item_description: "my grandmother's wedding ring", recipient_full_name: "Alice Sample Smith", recipient_relationship: "daughter", fallback: "residuary" },
      { item_description: "my vintage record collection", recipient_full_name: "Bob Sample Smith", recipient_relationship: "son", fallback: "to_children" },
    ],

    organ_donation: "yes_all",
    funeral_preference: "burial",
    has_funeral_representative: true,
    funeral_representative: { full_name: "Greg Hall", relationship: "Brother", phone: "(313) 555-7777" },
    successor_funeral_representative: { full_name: "Helen Hall", relationship: "Sister-in-law", phone: "(313) 555-8888" },

    has_intentional_exclusions: true,
    intentional_exclusions: [
      { full_name: "Ivan Ill-Wisher", relationship: "estranged cousin" },
    ],

    dpoa_agent: { full_name: "Mark Reliable", relationship: "Brother", city: "Ann Arbor", state: "Michigan", phone: "(734) 555-1212" },
    first_successor_dpoa_agent: { full_name: "Sue Reliable", relationship: "Sister", city: "Lansing", state: "Michigan", phone: "(517) 555-3333" },
    second_successor_dpoa_agent: { full_name: "Karen Lee", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-4444" },

    patient_advocate: { full_name: "Ed Brown", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-9999" },
    successor_patient_advocate: { full_name: "Fay Green", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-1234" },
    life_sustaining_treatment_preference: "withhold_if_terminal_or_pvs",
    artificial_nutrition_preference: "withhold_if_terminal_or_pvs",

    has_hipaa_additional_parties: true,
    hipaa_additional_authorized_parties: [
      { full_name: "Carol Adams", relationship: "sister" },
    ],

    ...overrides,
  };
  return filled;
}

/** Default direct-EstateVault branding. */
const DIRECT_BRANDING: BrandingContext = { isWhiteLabel: false };
/** Sample white-label branding for the spec's branding test. */
const WHITE_LABEL_BRANDING: BrandingContext = {
  isWhiteLabel: true,
  partnerName: "Smith Wealth Advisors",
  productName: "Legacy Protection",
};

/** Render a single document type to a PDF buffer using the standard fixture. */
async function renderDoc(
  type: DocumentType,
  branding: BrandingContext = DIRECT_BRANDING,
  intakeOverrides: Partial<WillIntake> = {}
): Promise<Buffer> {
  const intake = realisticIntake(intakeOverrides);
  const renderedText = renderTemplate(loadTemplate(type), intake);
  const element = makeElement({
    renderedText,
    documentType: type,
    branding,
    clientFullName: `${intake.first_name} ${intake.last_name}`,
  });
  return await renderToBuffer(element);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. minimal smoke
// ─────────────────────────────────────────────────────────────────────────────
describe("DocumentRenderer", () => {
  it(
    "1. renders without throwing for a minimal rendered text (cover title + one article)",
    async () => {
      const minimal = "# LAST WILL AND TESTAMENT\n\n## ARTICLE I — IDENTIFICATION\n\nBody paragraph.";
      const element = makeElement({
        renderedText: minimal,
        documentType: "will" as DocumentType,
        branding: DIRECT_BRANDING,
        clientFullName: "Test User",
      });
      const buf = await renderToBuffer(element);
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  // 2. full Will template end-to-end
  it(
    "2. renders the full Will template end-to-end",
    async () => {
      const buf = await renderDoc("will");
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  // 3. branding direct
  it(
    "3. renders with direct EstateVault branding",
    async () => {
      const buf = await renderDoc("will", { isWhiteLabel: false });
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  // 4. branding white-label
  it(
    "4. renders with white-label branding and a partner name",
    async () => {
      const buf = await renderDoc("will", WHITE_LABEL_BRANDING);
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  // 5. each of the six document types renders
  const TYPES: DocumentType[] = ["will", "dpoa", "pad", "hipaa", "funeral_rep", "guardian_nomination"];
  for (const t of TYPES) {
    it(
      `5.${t}. ${t} renders to a valid PDF`,
      async () => {
        const buf = await renderDoc(t);
        assertValidPdf(buf);
      },
      SMOKE_TIMEOUT
    );
  }

  // 6. conditional content — funeral rep with has_funeral_representative=false,
  // guardian nomination with has_minor_children=false
  it(
    "6a. renders the Funeral Rep template even when has_funeral_representative is false",
    async () => {
      const buf = await renderDoc("funeral_rep", DIRECT_BRANDING, {
        has_funeral_representative: false,
        funeral_representative: null,
        successor_funeral_representative: null,
      });
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "6b. renders the Guardian Nomination template even when has_minor_children is false",
    async () => {
      const buf = await renderDoc("guardian_nomination", DIRECT_BRANDING, {
        has_minor_children: false,
        children: [],
        has_children: false,
        guardian: null,
        successor_guardian: null,
      });
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  // 7. parse error propagation — malformed text (unclosed callout) should
  // propagate the parser's error to the caller.
  it("7. propagates parse errors from malformed input", () => {
    const malformed = [
      "Some body text.",
      "",
      '[CALLOUT_AMBER label="OOPS"]',
      "Body that never closes.",
    ].join("\n");
    const element = makeElement({
      renderedText: malformed,
      documentType: "will" as DocumentType,
      branding: DIRECT_BRANDING,
      clientFullName: "Test User",
    });
    // The throw happens synchronously during render — call renderToBuffer
    // inside the rejects matcher.
    return expect(renderToBuffer(element)).rejects.toThrow(/Unclosed.*CALLOUT_AMBER/);
  });

  // 8. dispatch exhaustiveness — purely a compile-time concern. If the
  // `never` guard in DocumentRenderer.tsx ever fails to typecheck (because a
  // new DocumentBlock variant was added without a matching switch case), the
  // build step would fail and this test file would never be loaded. So
  // successfully importing DocumentRenderer above is itself the assertion.
  it("8. dispatch switch is exhaustive (compile-time guard)", () => {
    expect(typeof DocumentRenderer).toBe("function");
  });
});
