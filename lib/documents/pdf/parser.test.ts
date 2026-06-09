import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRenderedText, type DocumentBlock } from "./parser";
import { renderTemplate } from "../render-template";
import { initialTemplateWillIntake as initialWillIntake, type TemplateWillIntake as WillIntake } from "../intake-adapter";

/**
 * Unit tests for `parseRenderedText`. Each numbered test maps to one of the
 * 20 cases enumerated in Phase B Part 3a, Step 5. Test 18 is the end-to-end
 * integration test that exercises the parser against Mike's real Michigan
 * Will template rendered with a complete intake fixture.
 *
 * Notes on test fixtures:
 *   - The parser's input is the resolved text produced by `renderTemplate`, so
 *     fixtures here are plain strings — no `{{merge variables}}` and no IF /
 *     FOREACH control tags.
 *   - Tests deliberately don't snapshot — each assertion targets a specific
 *     shape detail so failures point at the exact rule that broke.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. cover_title
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: cover blocks", () => {
  it("1. handles a single cover_title line", () => {
    const out = parseRenderedText("# LAST WILL AND TESTAMENT");
    expect(out).toEqual([{ type: "cover_title", text: "LAST WILL AND TESTAMENT" }]);
  });

  it("2. handles multiple cover_subtitle lines", () => {
    const out = parseRenderedText("#sub Of Jane Doe\n#sub State of Michigan");
    expect(out).toEqual([
      { type: "cover_subtitle", text: "Of Jane Doe" },
      { type: "cover_subtitle", text: "State of Michigan" },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. article_header
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: article_header", () => {
  it("3. parses '## ARTICLE I — IDENTIFICATION AND FAMILY'", () => {
    const out = parseRenderedText("## ARTICLE I — IDENTIFICATION AND FAMILY");
    expect(out).toEqual([{ type: "article_header", number: "I", title: "IDENTIFICATION AND FAMILY" }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. section_header — including trailing period in title
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: section_header", () => {
  it("4. parses '### Section 1.1 — Identification of Testator.' (trailing period preserved)", () => {
    const out = parseRenderedText("### Section 1.1 — Identification of Testator.");
    expect(out).toEqual([{ type: "section_header", number: "1.1", title: "Identification of Testator." }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. body block — consecutive non-empty lines
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: body blocks", () => {
  it("5. groups consecutive non-empty lines into a single body block", () => {
    const out = parseRenderedText("This is the first line.\nAnd a second line.\nAnd a third.");
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      type: "body",
      text: "This is the first line.\nAnd a second line.\nAnd a third.",
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. blank line separator
  // ───────────────────────────────────────────────────────────────────────────
  it("6. separates body blocks at blank lines", () => {
    const out = parseRenderedText("First paragraph line one.\nFirst paragraph line two.\n\nSecond paragraph.");
    expect(out).toEqual([
      { type: "body", text: "First paragraph line one.\nFirst paragraph line two." },
      { type: "body", text: "Second paragraph." },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. bullet
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: bullets", () => {
  it("7. handles bullet list items", () => {
    const out = parseRenderedText("- First item\n- Second item\n- Third item");
    expect(out).toEqual([
      { type: "bullet", text: "First item" },
      { type: "bullet", text: "Second item" },
      { type: "bullet", text: "Third item" },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. info_box
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: info_box", () => {
  it("8. handles INFO_BOX with multiple rows; ignores empty rows", () => {
    const input = [
      "[INFO_BOX]",
      "Testator: Jane Doe",
      "",
      "Date of Birth: April 12, 1975",
      "Residence: Detroit, Michigan",
      "[/INFO_BOX]",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      {
        type: "info_box",
        rows: ["Testator: Jane Doe", "Date of Birth: April 12, 1975", "Residence: Detroit, Michigan"],
      },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. callout_amber
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: callouts", () => {
  it("9. handles CALLOUT_AMBER with label and multi-line body joined", () => {
    const input = [
      '[CALLOUT_AMBER label="IMPORTANT"]',
      "This is a multi-line callout.",
      "Read this carefully before signing.",
      "[/CALLOUT_AMBER]",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      {
        type: "callout_amber",
        label: "IMPORTANT",
        text: "This is a multi-line callout. Read this carefully before signing.",
      },
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. CALLOUT_NAVY / CALLOUT_GREEN / CALLOUT_RED — same structure
  // ───────────────────────────────────────────────────────────────────────────
  it("10. handles CALLOUT_NAVY, CALLOUT_GREEN, and CALLOUT_RED with same structure", () => {
    const input = [
      '[CALLOUT_NAVY label="NOTE"]',
      "Navy callout body.",
      "[/CALLOUT_NAVY]",
      "",
      '[CALLOUT_GREEN label="OK"]',
      "Green callout body.",
      "[/CALLOUT_GREEN]",
      "",
      '[CALLOUT_RED label="WARN"]',
      "Red callout body.",
      "[/CALLOUT_RED]",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      { type: "callout_navy", label: "NOTE", text: "Navy callout body." },
      { type: "callout_green", label: "OK", text: "Green callout body." },
      { type: "callout_red", label: "WARN", text: "Red callout body." },
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. preference_card
  // ───────────────────────────────────────────────────────────────────────────
  it("11. handles PREFERENCE_CARD with label and body", () => {
    const input = [
      '[PREFERENCE_CARD label="MY ELECTED PREFERENCE"]',
      "Withhold if terminal condition.",
      "[/PREFERENCE_CARD]",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      {
        type: "preference_card",
        label: "MY ELECTED PREFERENCE",
        text: "Withhold if terminal condition.",
      },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. bold_statutory
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: bold_statutory", () => {
  it("12. handles BOLD_STATUTORY block", () => {
    const input = [
      "[BOLD_STATUTORY]",
      "Pursuant to MCL 700.5202, this nomination of guardian shall take effect.",
      "[/BOLD_STATUTORY]",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      {
        type: "bold_statutory",
        text: "Pursuant to MCL 700.5202, this nomination of guardian shall take effect.",
      },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. notary_block — self-closing
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: notary_block", () => {
  it("13. handles NOTARY_BLOCK as a self-closing marker on its own line", () => {
    const out = parseRenderedText("Some body text.\n\n[NOTARY_BLOCK]\n\nMore body.");
    expect(out).toEqual([
      { type: "body", text: "Some body text." },
      { type: "notary_block" },
      { type: "body", text: "More body." },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. signature
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: signature", () => {
  it("14. handles SIGNATURE with label in canonical and alternate forms", () => {
    // Canonical attribute form per the spec
    let out = parseRenderedText('[SIGNATURE label="Testator"]');
    expect(out).toEqual([{ type: "signature", label: "Testator" }]);
    // Alternate form produced by extract.js: `[SIGNATURE] LABEL`
    out = parseRenderedText("[SIGNATURE] Witness One — Printed Name and Address");
    expect(out).toEqual([{ type: "signature", label: "Witness One — Printed Name and Address" }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. page_break
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: page_break", () => {
  it("15. handles PAGE_BREAK on its own line", () => {
    const out = parseRenderedText("Above the break.\n\n[PAGE_BREAK]\n\nBelow the break.");
    expect(out).toEqual([
      { type: "body", text: "Above the break." },
      { type: "page_break" },
      { type: "body", text: "Below the break." },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. power_granted
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: power indicators", () => {
  it("16. handles power_granted: '**Banking.** GRANTED.' + following body paragraph", () => {
    const input = [
      "**Banking.** GRANTED.",
      "The Agent is authorized to access and manage my bank accounts and",
      "to write checks and authorize transfers.",
      "",
      "Next paragraph.",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      {
        type: "power_granted",
        powerName: "Banking",
        text:
          "The Agent is authorized to access and manage my bank accounts and " +
          "to write checks and authorize transfers.",
      },
      { type: "body", text: "Next paragraph." },
    ]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 17. power_not_granted
  // ───────────────────────────────────────────────────────────────────────────
  it("17. handles power_not_granted: '**Gift-Making.** NOT GRANTED.' + following body", () => {
    const input = [
      "**Gift-Making.** NOT GRANTED.",
      "The Agent is NOT authorized to make gifts of my property.",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      {
        type: "power_not_granted",
        powerName: "Gift-Making",
        text: "The Agent is NOT authorized to make gifts of my property.",
      },
    ]);
  });

  it("17b. terminates power body at the next structural marker (article header)", () => {
    const input = [
      "**Banking.** GRANTED.",
      "Body line one.",
      "## ARTICLE V — RESIDUARY ESTATE",
      "After the header.",
    ].join("\n");
    const out = parseRenderedText(input);
    expect(out).toEqual([
      { type: "power_granted", powerName: "Banking", text: "Body line one." },
      { type: "article_header", number: "V", title: "RESIDUARY ESTATE" },
      { type: "body", text: "After the header." },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. end-to-end: real Michigan Will template
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: end-to-end on real template", () => {
  /** Build the same realistic intake fixture used by the resolver integration tests. */
  function realisticIntake(): WillIntake {
    const base = JSON.parse(JSON.stringify(initialWillIntake)) as WillIntake;
    return {
      ...base,
      first_name: "Jane",
      middle_name: "Quincy",
      last_name: "Public",
      suffix: "None",
      date_of_birth: "1975-04-12",
      street_address: "123 Maple Street",
      city: "Detroit",
      county: "Wayne",
      zip: "48201",
      marital_status: "Married",
      spouse_full_name: "John Public",
      has_children: true,
      children: [
        { full_name: "Alice Public", date_of_birth: "2010-06-01", is_minor: true },
        { full_name: "Bob Public", date_of_birth: "2008-08-22", is_minor: true },
      ],
      has_minor_children: true,
      personal_representative: { full_name: "Mark Smith", relationship: "Brother", city: "Ann Arbor", state: "Michigan", phone: "(734) 555-1212" },
      successor_personal_representative: { full_name: "Sue Doe", relationship: "Sister", city: "Lansing", state: "Michigan" },
      second_successor_personal_representative: null,
      primary_beneficiaries: [
        { full_name: "Alice Public", relationship: "daughter", share_percent: "50", per_stirpes: true },
        { full_name: "Bob Public", relationship: "son", share_percent: "50", per_stirpes: true },
      ],
      guardian: { full_name: "Carol Adams", relationship: "Aunt", city: "Grand Rapids", state: "Michigan", phone: "(616) 555-3434" },
      successor_guardian: { full_name: "Dan Adams", relationship: "Uncle" },
      has_specific_gifts: true,
      specific_gifts: [
        { item_description: "my grandmother's wedding ring", recipient_full_name: "Alice Public", recipient_relationship: "daughter", fallback: "residuary" },
      ],
      organ_donation: "yes_all",
      funeral_preference: "burial",
      has_funeral_representative: true,
      funeral_representative: { full_name: "Greg Hall", relationship: "Brother", phone: "(313) 555-7777" },
      patient_advocate: { full_name: "Ed Brown", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-9999" },
      successor_patient_advocate: { full_name: "Fay Green", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-1234" },
      life_sustaining_treatment_preference: "withhold_if_terminal_or_pvs",
      artificial_nutrition_preference: "withhold_if_terminal_or_pvs",
    };
  }

  it("18. parses Mike's rendered Will template into a non-empty mixed DocumentBlock[]", () => {
    const tplPath = join(__dirname, "..", "templates", "will-michigan-v1.1.0.txt");
    const tpl = readFileSync(tplPath, "utf8");
    const rendered = renderTemplate(tpl, realisticIntake());
    const blocks = parseRenderedText(rendered);

    expect(blocks.length).toBeGreaterThan(20);

    // Count occurrences of the structural block types we expect from this template.
    const counts: Record<DocumentBlock["type"], number> = {
      cover_title: 0,
      cover_subtitle: 0,
      article_header: 0,
      section_header: 0,
      body: 0,
      bullet: 0,
      info_box: 0,
      callout_amber: 0,
      callout_navy: 0,
      callout_green: 0,
      callout_red: 0,
      preference_card: 0,
      power_granted: 0,
      power_not_granted: 0,
      signature: 0,
      notary_block: 0,
      page_break: 0,
      bold_statutory: 0,
    };
    for (const b of blocks) counts[b.type]++;

    // ARTICLEs I through X are all present in the rendered Will (Article VI is
    // gated by has_minor_children=true, which our fixture sets).
    expect(counts.article_header).toBeGreaterThanOrEqual(10);
    // Many Sections (1.1, 1.2, 1.3, 2.1–2.6, 3.1, 3.2, ...).
    expect(counts.section_header).toBeGreaterThan(20);
    // Body paragraphs make up the bulk of the document.
    expect(counts.body).toBeGreaterThan(20);
    // The extract.js wrapper emits exactly one [NOTARY_BLOCK] marker per template.
    expect(counts.notary_block).toBe(1);
    // extract.js prefixes signer lines with [SIGNATURE]; at least the Testator
    // and the two attestation witnesses are present.
    expect(counts.signature).toBeGreaterThanOrEqual(3);

    // Note: info_box and callout block types aren't in Mike's current source
    // .docx vocabulary, so we don't assert their presence. They're supported
    // by the parser for future templates.

    // Sanity: at least one article carries a non-empty title.
    const firstArticle = blocks.find((b) => b.type === "article_header");
    expect(firstArticle).toBeDefined();
    if (firstArticle && firstArticle.type === "article_header") {
      expect(firstArticle.title.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. error: unclosed callout
// ─────────────────────────────────────────────────────────────────────────────
describe("parser: error reporting", () => {
  it("19. throws a clear error when a callout is left unclosed", () => {
    const input = [
      "Some body text.",
      "",
      '[CALLOUT_AMBER label="HEY"]',
      "Body of the callout that never closes.",
    ].join("\n");
    expect(() => parseRenderedText(input)).toThrow(/Unclosed.*CALLOUT_AMBER.*line 3/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 20. error: unmatched closing tag
  // ───────────────────────────────────────────────────────────────────────────
  it("20. throws a clear error when a closing tag has no matching opener", () => {
    const input = ["Some body text.", "", "[/CALLOUT_GREEN]"].join("\n");
    expect(() => parseRenderedText(input)).toThrow(/Unmatched closing tag at line 3.*CALLOUT_GREEN/);
  });
});
