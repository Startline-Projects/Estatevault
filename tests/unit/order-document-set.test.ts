/**
 * What an EXISTING order's generators produce and its monitors expect.
 *
 * Five routes each kept a private four-type list for a Trust Package. Replacing
 * those with expectedDocumentTypes() fixed new orders and would have broken old
 * ones: an order created when the package was four documents has four rows, and
 * measured against today's seven it looks permanently unfinished — the
 * reconcile cron would re-dispatch it, regenerate it and alert on it every
 * fifteen minutes, forever. So the rows an order has are what it is measured
 * by; the owed list only applies to an order with no rows yet.
 */

import { describe, it, expect } from "vitest";
import {
  documentTypesForOrder,
  expectedDocumentTypes,
  orderDocumentProgress,
} from "@/lib/documents/trust-package";
import { getTemplate } from "@/lib/documents/templates/resolve";
import { TemplateBlockedError } from "@/lib/documents/generate-from-template";

const JOINT = { isJointTrust: "Yes", secondGrantorName: "Jane Doe" };
const SINGLE = { isJointTrust: "No" };
const EIGHT = [
  "trust", "certification_of_trust", "assignment_personal_property_g1", "assignment_personal_property_g2",
  "pour_over_will", "trust_funding_instructions", "poa", "healthcare_directive",
];
const SEVEN = EIGHT.filter((t) => t !== "assignment_personal_property_g2");
const LEGACY_FOUR = ["trust", "pour_over_will", "poa", "healthcare_directive"];

const done = (types: string[]) => types.map((t) => ({ document_type: t, storage_path: `c/o/${t}.pdf` }));
const pending = (types: string[]) => types.map((t) => ({ document_type: t, storage_path: null }));

describe("documentTypesForOrder", () => {
  it("an order with no rows yet owes what the product owes", () => {
    expect(documentTypesForOrder("trust", JOINT, [])).toEqual(EIGHT);
    expect(documentTypesForOrder("trust", SINGLE, [])).toEqual(SEVEN);
    expect(documentTypesForOrder("will", {}, [])).toEqual(["will", "poa", "healthcare_directive"]);
    expect(documentTypesForOrder("trust", JOINT, [])).toEqual(expectedDocumentTypes("trust", JOINT));
  });

  it("an order with rows is its rows, in delivery order, whatever order they arrive in", () => {
    const shuffled = ["healthcare_directive", "assignment_personal_property_g2", "trust", "poa",
      "trust_funding_instructions", "certification_of_trust", "pour_over_will", "assignment_personal_property_g1"];
    expect(documentTypesForOrder("trust", JOINT, shuffled)).toEqual(EIGHT);
  });

  it("a joint order keeps its eighth document even if the intake passed in says nothing", () => {
    // The generators used to re-derive the list from intake; handing them the
    // wrong snapshot (or null) silently dropped the second Grantor's assignment.
    expect(documentTypesForOrder("trust", null, EIGHT)).toEqual(EIGHT);
    expect(documentTypesForOrder("trust", SINGLE, EIGHT)).toEqual(EIGHT);
  });

  it("an order created when the package was four documents stays four", () => {
    expect(documentTypesForOrder("trust", JOINT, LEGACY_FOUR)).toEqual(LEGACY_FOUR);
  });

  it("ignores duplicate and empty row types, and keeps an unknown type rather than dropping it", () => {
    expect(documentTypesForOrder("will", {}, ["poa", "will", "poa", null, undefined, "healthcare_directive"]))
      .toEqual(["will", "poa", "healthcare_directive"]);
    expect(documentTypesForOrder("trust", {}, ["mystery_doc", "trust"])).toEqual(["trust", "mystery_doc"]);
  });
});

describe("orderDocumentProgress — what the reconcile cron and the admin screen measure", () => {
  it("a joint trust with seven of its eight files is NOT finished", () => {
    const docs = [...done(SEVEN), ...pending(["assignment_personal_property_g2"])];
    const p = orderDocumentProgress("trust", JOINT, docs);
    expect(p.complete).toBe(false);
    expect(p.missing).toEqual(["assignment_personal_property_g2"]);
    expect(p.present).toHaveLength(7);
  });

  it("…and that does not depend on being handed the right intake", () => {
    const docs = [...done(SEVEN), ...pending(["assignment_personal_property_g2"])];
    expect(orderDocumentProgress("trust", null, docs).complete).toBe(false);
  });

  it("the old four-of-seven 'finished' order is not finished", () => {
    const docs = [...done(LEGACY_FOUR), ...pending(["certification_of_trust", "assignment_personal_property_g1", "trust_funding_instructions"])];
    const p = orderDocumentProgress("trust", SINGLE, docs);
    expect(p.complete).toBe(false);
    expect(p.missing).toEqual(["certification_of_trust", "assignment_personal_property_g1", "trust_funding_instructions"]);
  });

  it("all eight files → finished", () => {
    expect(orderDocumentProgress("trust", JOINT, done(EIGHT))).toMatchObject({ complete: true, missing: [] });
  });

  it("an order created with four rows, all generated, is finished — it is not re-dispatched or alerted on", () => {
    expect(orderDocumentProgress("trust", JOINT, done(LEGACY_FOUR))).toMatchObject({ complete: true, missing: [] });
  });

  it("a paid order with no rows at all is unfinished against what the product owes", () => {
    const p = orderDocumentProgress("trust", SINGLE, []);
    expect(p.complete).toBe(false);
    expect(p.missing).toEqual(SEVEN);
  });
});

describe("a document type with no legacy generator is a hold, not a retry", () => {
  // With PDF_RENDERER off (or a template check failing in non-strict mode) the
  // generators fall back to getTemplate(). Four Trust Package types exist only
  // as templates. As a plain Error the order went `failed`, which the reconcile
  // cron retries every 15 minutes — re-running Claude for the documents that
  // had worked. TemplateBlockedError parks the order as `blocked` instead.
  it.each(["certification_of_trust", "assignment_personal_property_g1", "assignment_personal_property_g2", "trust_funding_instructions"])(
    "%s → TemplateBlockedError",
    async (docType) => {
      const err = await getTemplate(docType).then(() => null, (e) => e);
      expect(err).toBeInstanceOf(TemplateBlockedError);
      expect((err as TemplateBlockedError).docType).toBe(docType);
      expect((err as TemplateBlockedError).reasons.join(" ")).toMatch(/PDF_RENDERER/);
    },
  );

  it.each(["will", "poa", "healthcare_directive", "trust", "pour_over_will"])(
    "%s still has its legacy generator",
    async (docType) => {
      const t = await getTemplate(docType);
      expect(typeof t.buildPrompt).toBe("function");
      expect(typeof t.systemPrompt).toBe("string");
    },
  );
});
