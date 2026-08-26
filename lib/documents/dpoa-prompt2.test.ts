/**
 * Prompt 2 — Durable Power of Attorney.
 *
 * Covers the five changes from Mo's review notes:
 *   1. springing vs immediate effective-date branching, and the conditional
 *      instruction-sheet text that goes with it
 *   2. no witness attestation (Michigan requires no witnesses for a POA)
 *   3. no "Recommended under MCL 556.205..." line
 *   4. the Agent's Acknowledgment keeps its page; its instruction paragraph
 *      has moved to the instruction sheet
 *   5. document order: power of attorney, acknowledgment, instructions
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, type TemplateWillIntake } from "./intake-adapter";

const TEMPLATE = readFileSync(
  join(__dirname, "templates", "dpoa-michigan-v1.1.0.txt"),
  "utf8",
);

function intake(overrides: Record<string, unknown> = {}): TemplateWillIntake {
  const r = mapIntakeToTemplateData({
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    poaAgentName: "Raga Hassan",
    poaAgentRelationship: "Spouse",
    poaSuccessorAgentName: "Karim Hassan",
    poaPowers: ["Banking and finances"],
    poaEffective: "immediate",
    ...overrides,
  });
  expect(r.error).toBeNull();
  return r.data!;
}

const render = (o: Record<string, unknown> = {}) => renderTemplate(TEMPLATE, intake(o));

describe("1. effective-date branching", () => {
  it("renders the immediate branch and not the springing branch", () => {
    const out = render({ poaEffective: "immediate" });
    expect(out).toContain("Section 3.1 — Effective Immediately");
    expect(out).toContain("effective immediately upon execution");
    expect(out).not.toContain("Section 3.1 — Springing Effectiveness");
    expect(out).not.toContain("Certification of Incapacity");
  });

  it("renders the springing branch and not the immediate branch", () => {
    const out = render({ poaEffective: "springing" });
    expect(out).toContain("Section 3.1 — Springing Effectiveness");
    expect(out).toContain("shall not become effective until a physician");
    expect(out).toContain("Section 3.3 — Restoration of Capacity");
    expect(out).not.toContain("Section 3.1 — Effective Immediately");
  });

  it("explains in plain language that a springing agent has no power until incapacity", () => {
    const out = render({ poaEffective: "springing" });
    const sheet = out.slice(out.indexOf("## OPERATION OF THIS DOCUMENT"));
    expect(sheet).toContain("has no power to act");
    expect(sheet).toContain("unless and until you become unable to manage your own financial affairs");
    expect(sheet).toContain("may not touch your accounts");
    // The immediate wording must not leak into a springing document.
    expect(sheet).not.toContain("as soon as you have signed this document");
  });

  it("gives the immediate document its own instruction-sheet wording", () => {
    const sheet = render({ poaEffective: "immediate" });
    const s = sheet.slice(sheet.indexOf("## OPERATION OF THIS DOCUMENT"));
    expect(s).toContain("effective immediately");
    expect(s).not.toContain("springing");
  });
});

describe("2. witness attestation removed", () => {
  it("has no witness signature lines and no attestation section", () => {
    const out = render();
    expect(out).not.toContain("[SIGNATURE] Witness One");
    expect(out).not.toContain("[SIGNATURE] Witness Two");
    expect(out).not.toContain("## ATTESTATION");
    expect(out).not.toContain("subscribed our names as witnesses");
    expect(out).not.toContain("in the presence of the two witnesses");
  });

  it("keeps the principal's signature and the notary acknowledgment", () => {
    const out = render();
    expect(out).toContain("## EXECUTION BY THE PRINCIPAL");
    expect(out).toContain("[SIGNATURE] Principal");
    expect(out).toContain("[NOTARY_BLOCK]");
  });

  it("tells the client no witnesses are needed", () => {
    expect(render()).toContain("Michigan does not require witnesses for a power of attorney");
  });
});

describe("3. MCL 556.205 recommendation removed", () => {
  it("no longer appears anywhere in the document", () => {
    expect(render()).not.toContain("556.205");
    expect(render()).not.toContain("enhance third-party acceptance");
  });
});

describe("4. Agent's Acknowledgment", () => {
  it("keeps the page and the acknowledgment itself", () => {
    const out = render();
    expect(out).toContain("## AGENT'S ACKNOWLEDGMENT OF DUTIES");
    expect(out).toContain("I, the undersigned Agent, accept appointment as Agent");
    expect(out).toContain("[SIGNATURE] Primary Agent");
  });

  it("drops the instruction paragraph from the top of the page", () => {
    const out = render();
    expect(out).not.toContain("Each Agent (primary and any Successor Agent) is requested to sign");
    expect(out).not.toContain("## IMPORTANT NOTICE TO AGENT");
  });

  it("moves that content to the instruction sheet, rewritten", () => {
    const out = render();
    const sheet = out.slice(out.indexOf("## OPERATION OF THIS DOCUMENT"));
    expect(sheet).toContain("not required to make this power of attorney effective");
    expect(sheet).toContain("some institutions require a signed acceptance");
  });
});

describe("5. document order", () => {
  it("runs power of attorney, then acknowledgment, then instructions", () => {
    const out = render();
    const poa = out.indexOf("## ARTICLE I");
    const execution = out.indexOf("## EXECUTION BY THE PRINCIPAL");
    const ack = out.indexOf("## AGENT'S ACKNOWLEDGMENT OF DUTIES");
    const sheet = out.indexOf("## OPERATION OF THIS DOCUMENT");

    expect(poa).toBeGreaterThan(-1);
    expect(execution).toBeGreaterThan(poa);
    expect(ack).toBeGreaterThan(execution);
    expect(sheet).toBeGreaterThan(ack);
  });

  it("starts the acknowledgment and the instructions on their own pages", () => {
    const blocks = parseRenderedText(render());
    const ackIdx = blocks.findIndex(
      (b) => b.type === "document_header" && b.text === "AGENT'S ACKNOWLEDGMENT OF DUTIES",
    );
    const sheetIdx = blocks.findIndex(
      (b) => b.type === "document_header" && b.text === "OPERATION OF THIS DOCUMENT",
    );
    expect(blocks[ackIdx - 1]?.type).toBe("page_break");
    expect(blocks[sheetIdx - 1]?.type).toBe("page_break");
  });
});

describe("powers still honour the client's selection", () => {
  it("grants only banking for a banking-only selection", () => {
    const out = render({ poaPowers: ["Banking and finances"] });
    expect(out).toContain("Banking and Financial Institution Transactions.  GRANTED.");
    expect(out).not.toContain("Real Estate Transactions.  GRANTED.");
  });
});
