/**
 * Prompt 5 — Revocable Living Trust.
 *
 *   3. the Grantor is always the initial Trustee
 *   4. Article VI renders only when there are specific gifts
 *   5. the Trustee Acceptance section is gone
 *   6. the instruction sheet states in bold that assets must be titled into
 *      the trust, and that funding instructions are included
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate } from "./render-template";
import { parseRenderedText } from "./pdf/parser";
import { mapIntakeToTemplateData, type TemplateWillIntake } from "./intake-adapter";

const TEMPLATE = readFileSync(join(__dirname, "templates", "trust-michigan-v1.1.0.txt"), "utf8");

function intake(overrides: Partial<TemplateWillIntake> = {}): TemplateWillIntake {
  const r = mapIntakeToTemplateData({
    firstName: "Ahmed",
    lastName: "Hassan",
    city: "Dearborn",
    state: "Michigan",
    successorTrusteeName: "Raga Hassan",
    successorTrusteeRelationship: "Spouse/Partner",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "" }],
  });
  expect(r.error).toBeNull();
  return { ...r.data!, ...overrides } as TemplateWillIntake;
}

const render = (o: Partial<TemplateWillIntake> = {}) => renderTemplate(TEMPLATE, intake(o));
const articleIII = (out: string) =>
  out.slice(out.indexOf("## ARTICLE III"), out.indexOf("## ARTICLE IV"));

describe("3. the Grantor is always the initial Trustee", () => {
  it("Section 3.1 names the Grantor", () => {
    const a3 = articleIII(render());
    expect(a3).toContain("Section 3.1 — Initial Trustee");
    expect(a3).toContain("The Grantor shall serve as the initial Trustee");
  });

  it("Section 3.2 is the first successor and 3.3 the backup", () => {
    const a3 = articleIII(render({
      second_successor_trustee: { full_name: "Karim Hassan", relationship: "Sibling", city: "Dearborn", state: "Michigan" },
    }));
    expect(a3).toContain("Section 3.2 — First Successor Trustee");
    expect(a3).toContain("Raga Hassan");
    expect(a3).toContain("Section 3.3 — Second Successor Trustee");
    expect(a3).toContain("Karim Hassan");
  });

  it("never asks who the initial trustee is, whatever the intake says", () => {
    // trustee_is_self / trustee.full_name no longer influence the instrument.
    const asIfNamed = render({
      trustee_is_self: false,
      trustee: { full_name: "Someone Else", relationship: "Friend", city: "Detroit", state: "Michigan" },
    });
    expect(articleIII(asIfNamed)).toContain("The Grantor shall serve as the initial Trustee");
    expect(asIfNamed).not.toContain("Someone Else");
  });

  it("the cover block and successor clauses refer to the Grantor", () => {
    const out = render();
    expect(out).toContain("Initial Trustee: Ahmed Hassan (Grantor serving as Trustee)");
    expect(out).toContain("If the Grantor is unable or unwilling to continue serving as Trustee");
    expect(out).toContain("If the Grantor and all named Successor Trustees are unable");
  });
});

describe("4. Article VI is conditional", () => {
  const gift = [{ item_description: "a pocket watch", recipient_full_name: "Omar Hassan", recipient_relationship: "son", fallback: "residuary" }];

  it("appears as Specific Gifts when gifts exist", () => {
    const out = render({ has_specific_gifts: true, specific_gifts: gift });
    expect(out).toContain("## ARTICLE VI — SPECIFIC GIFTS");
    expect(out).toContain("a pocket watch");
  });

  it("disappears entirely when there are none — no placeholder article", () => {
    const out = render({ has_specific_gifts: false, specific_gifts: [] });
    expect(out).not.toContain("SPECIFIC GIFTS");
    expect(out).not.toContain("No specific gifts are made under this Trust");
    expect(out).toContain("## ARTICLE VI — DISTRIBUTION OF TRUST ESTATE");
  });

  it("cross-references to the distribution article follow it either way", () => {
    const withGifts = render({ has_specific_gifts: true, specific_gifts: gift });
    const without = render({ has_specific_gifts: false, specific_gifts: [] });
    // Whatever number it took, no reference points at a missing article, which
    // assignNumbering would have thrown for.
    expect(withGifts).toContain("## ARTICLE VII — DISTRIBUTION OF TRUST ESTATE");
    expect(without).toContain("## ARTICLE VI — DISTRIBUTION OF TRUST ESTATE");
  });
});

describe("5. Trustee Acceptance is removed", () => {
  it("is absent from the template and the rendered document", () => {
    expect(TEMPLATE).not.toContain("TRUSTEE ACCEPTANCE");
    const out = render();
    expect(out).not.toContain("TRUSTEE ACCEPTANCE");
    expect(out).not.toContain("accept appointment as Trustee");
    expect(out).not.toContain("[SIGNATURE] Trustee — Signature and Date");
  });

  it("leaves the execution and notary sections intact", () => {
    const out = render();
    expect(out).toContain("[SIGNATURE] Grantor");
    expect(out).toContain("[NOTARY_BLOCK]");
    expect(out).toContain("## SCHEDULE A — TRUST ASSETS");
  });
});

describe("6. the funding line is bold on the instruction sheet", () => {
  it("states both required sentences", () => {
    const out = render();
    const sheet = out.slice(out.indexOf("## OPERATION OF THIS DOCUMENT"));
    expect(sheet).toContain("Assets must be titled into the trust for the trust to work.");
    expect(sheet).toContain("We have included funding instructions to assist you.");
  });

  it("renders them as a bold block, not ordinary body text", () => {
    const blocks = parseRenderedText(render());
    const bold = blocks.filter((b) => b.type === "bold_statutory") as Array<{ text: string }>;
    expect(bold).toHaveLength(1);
    expect(bold[0].text).toContain("Assets must be titled into the trust");
    expect(bold[0].text).toContain("funding instructions to assist you");
  });

  it("drops the statute strip from the sheet", () => {
    const sheet = render().slice(render().indexOf("## OPERATION OF THIS DOCUMENT"));
    expect(sheet).not.toContain("Michigan EPIC, MCL 700.7101 et seq.");
    expect(sheet).not.toContain("Michigan Uniform Fiduciary Access to Digital Assets Act, MCL 700.1003");
  });
});

describe("single-grantor structure renders end to end", () => {
  it("produces a complete document with no unresolved tags", () => {
    const out = render();
    expect(out).not.toContain("{{");
    expect(out).not.toContain("[[");
    expect(out).toContain("THE AHMED HASSAN REVOCABLE LIVING TRUST");
  });
});
