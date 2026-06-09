import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate } from "./render-template";
import { computeDerivedFields } from "./computed-fields";
import { initialTemplateWillIntake as initialWillIntake, type TemplateWillIntake as WillIntake } from "./intake-adapter";

/** Build a complete, valid WillIntake from the canonical initial shape plus overrides. */
function makeIntake(overrides: Record<string, unknown> = {}): WillIntake {
  return { ...JSON.parse(JSON.stringify(initialWillIntake)), ...overrides } as WillIntake;
}

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Merge variable resolution
// ─────────────────────────────────────────────────────────────────────────────
describe("merge variables", () => {
  it("1. resolves a simple top-level field", () => {
    expect(renderTemplate("{{first_name}}", makeIntake({ first_name: "Jane" }))).toBe("Jane");
  });

  it("2. resolves a dot-notation path", () => {
    const intake = makeIntake({
      personal_representative: { full_name: "Pat Rep", relationship: "Spouse", city: "Detroit", state: "Michigan", phone: "(616) 555-1234" },
    });
    expect(renderTemplate("{{personal_representative.full_name}}", intake)).toBe("Pat Rep");
  });

  it("3. computed client_full_name joins parts with/without middle and suffix", () => {
    expect(renderTemplate("{{client_full_name}}", makeIntake({ first_name: "John", middle_name: "", last_name: "Smith", suffix: "None" }))).toBe("John Smith");
    expect(renderTemplate("{{client_full_name}}", makeIntake({ first_name: "John", middle_name: "Quincy", last_name: "Smith", suffix: "Jr." }))).toBe("John Quincy Smith Jr.");
  });

  it("4. computed client_full_name_upper is uppercased", () => {
    expect(renderTemplate("{{client_full_name_upper}}", makeIntake({ first_name: "Jane", last_name: "Doe", suffix: "None" }))).toBe("JANE DOE");
  });

  it("5. computed generation_date returns today in long format (mocked clock)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0, 0));
    expect(renderTemplate("{{generation_date}}", makeIntake())).toBe("November 12, 2026");
    expect(renderTemplate("{{generation_date_short}}", makeIntake())).toBe("11/12/2026");
  });

  it("6. computed hipaa_expiration_date is today + 7 years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0, 0));
    expect(renderTemplate("{{hipaa_expiration_date}}", makeIntake())).toBe("November 12, 2033");
  });

  it("7. computed organ_donation_purposes_joined joins with ', '", () => {
    expect(renderTemplate("{{organ_donation_purposes_joined}}", makeIntake({ organ_donation_purposes: ["Transplantation", "Research"] }))).toBe("Transplantation, Research");
    expect(renderTemplate("{{organ_donation_purposes_joined}}", makeIntake({ organ_donation_purposes: [] }))).toBe("");
  });

  it("8. null/undefined field becomes empty string", () => {
    expect(renderTemplate("[{{dpoa_agent_compensation_amount}}]", makeIntake({ dpoa_agent_compensation_amount: null }))).toBe("[]");
  });

  it("9. missing field (not in namespace) throws a clear error", () => {
    expect(() => renderTemplate("{{totally_made_up_field}}", makeIntake())).toThrow(/Merge variable not found: \{\{totally_made_up_field\}\}/);
  });

  it("10. number value renders as its string form", () => {
    const intake = makeIntake({ some_number: 50 } as Record<string, unknown>);
    expect(renderTemplate("{{some_number}}", intake)).toBe("50");
  });

  it("11. boolean value renders as 'true'/'false'", () => {
    expect(renderTemplate("{{has_children}}", makeIntake({ has_children: true }))).toBe("true");
    expect(renderTemplate("{{has_children}}", makeIntake({ has_children: false }))).toBe("false");
  });

  it("client_dob renders in long and short formats; empty when missing", () => {
    expect(renderTemplate("{{client_dob}}", makeIntake({ date_of_birth: "1975-01-15" }))).toBe("January 15, 1975");
    expect(renderTemplate("{{client_dob_short}}", makeIntake({ date_of_birth: "1975-01-15" }))).toBe("1/15/1975");
    expect(renderTemplate("{{client_dob}}", makeIntake({ date_of_birth: "" }))).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IF block evaluation
// ─────────────────────────────────────────────────────────────────────────────
describe("IF blocks", () => {
  it("12. truthy check renders body when value is non-empty", () => {
    const intake = makeIntake({ attorney_review_purchased: true } as Record<string, unknown>);
    expect(renderTemplate("{{#IF attorney_review_purchased}}YES{{/IF}}", intake)).toBe("YES");
  });

  it("13. truthy check skips body for false/null/undefined/empty/0/empty-array", () => {
    expect(renderTemplate("a{{#IF f}}X{{/IF}}b", makeIntake({ f: false } as Record<string, unknown>))).toBe("ab");
    expect(renderTemplate("a{{#IF f}}X{{/IF}}b", makeIntake({ f: null } as Record<string, unknown>))).toBe("ab");
    expect(renderTemplate("a{{#IF f}}X{{/IF}}b", makeIntake({ f: "" } as Record<string, unknown>))).toBe("ab");
    expect(renderTemplate("a{{#IF f}}X{{/IF}}b", makeIntake({ f: 0 } as Record<string, unknown>))).toBe("ab");
    expect(renderTemplate("a{{#IF f}}X{{/IF}}b", makeIntake({ f: [] } as Record<string, unknown>))).toBe("ab");
  });

  it("14/15. equals string renders only on match", () => {
    expect(renderTemplate('{{#IF marital_status equals "Married"}}M{{/IF}}', makeIntake({ marital_status: "Married" }))).toBe("M");
    expect(renderTemplate('{{#IF marital_status equals "Married"}}M{{/IF}}', makeIntake({ marital_status: "Single" }))).toBe("");
  });

  it("16. equals true renders when boolean true", () => {
    expect(renderTemplate("{{#IF has_children equals true}}HC{{/IF}}", makeIntake({ has_children: true }))).toBe("HC");
    expect(renderTemplate("{{#IF has_children equals true}}HC{{/IF}}", makeIntake({ has_children: false }))).toBe("");
  });

  it("17. equals false renders when boolean false", () => {
    expect(renderTemplate("{{#IF no_contest_clause equals false}}NCF{{/IF}}", makeIntake({ no_contest_clause: false }))).toBe("NCF");
    expect(renderTemplate("{{#IF no_contest_clause equals false}}NCF{{/IF}}", makeIntake({ no_contest_clause: true }))).toBe("");
  });

  it("18/19. contains renders only when array includes value", () => {
    expect(renderTemplate('{{#IF dpoa_powers contains "banking"}}B{{/IF}}', makeIntake({ dpoa_powers: ["banking", "tax"] }))).toBe("B");
    expect(renderTemplate('{{#IF dpoa_powers contains "banking"}}B{{/IF}}', makeIntake({ dpoa_powers: ["tax"] }))).toBe("");
  });

  it("20/21. does_not_contain renders only when array lacks value", () => {
    expect(renderTemplate('{{#IF dpoa_powers does_not_contain "gift_making"}}NG{{/IF}}', makeIntake({ dpoa_powers: ["banking"] }))).toBe("NG");
    expect(renderTemplate('{{#IF dpoa_powers does_not_contain "gift_making"}}NG{{/IF}}', makeIntake({ dpoa_powers: ["gift_making"] }))).toBe("");
  });

  it("22. nested IF: outer passes, inner evaluated", () => {
    const intake = makeIntake({ a: true, b: true } as Record<string, unknown>);
    expect(renderTemplate("{{#IF a}}[{{#IF b}}B{{/IF}}]{{/IF}}", intake)).toBe("[B]");
  });

  it("23. nested IF: outer fails → inner never evaluated (even if its condition would be bad)", () => {
    const intake = makeIntake({ a: false } as Record<string, unknown>);
    // The inner condition is intentionally malformed; it must NOT be evaluated.
    expect(renderTemplate("{{#IF a}}{{#IF x foo bar}}B{{/IF}}{{/IF}}", intake)).toBe("");
  });

  it("24. unclosed IF throws a clear error", () => {
    expect(() => renderTemplate("{{#IF has_children}}hello", makeIntake())).toThrow(/Unclosed IF block/);
  });

  it("25. unknown condition operator throws a clear error", () => {
    expect(() => renderTemplate("{{#IF foo bar baz}}x{{/IF}}", makeIntake({ foo: 1 } as Record<string, unknown>))).toThrow(/Unrecognized condition syntax/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FOREACH block expansion
// ─────────────────────────────────────────────────────────────────────────────
describe("FOREACH blocks", () => {
  it("26. iterates array of objects, rendering each item's body", () => {
    const intake = makeIntake({ children: [{ full_name: "A", date_of_birth: "", is_minor: false }, { full_name: "B", date_of_birth: "", is_minor: false }] });
    expect(renderTemplate("{{#FOREACH children}}{{full_name}};{{/FOREACH}}", intake)).toBe("A;B;");
  });

  it("27. empty array produces no output", () => {
    expect(renderTemplate("x{{#FOREACH children}}{{full_name}}{{/FOREACH}}y", makeIntake({ children: [] }))).toBe("xy");
  });

  it("28. missing/null/undefined array produces no output (no crash)", () => {
    expect(renderTemplate("x{{#FOREACH children}}Z{{/FOREACH}}y", makeIntake({ children: null } as Record<string, unknown>))).toBe("xy");
    expect(renderTemplate("x{{#FOREACH not_a_field}}Z{{/FOREACH}}y", makeIntake())).toBe("xy");
  });

  it("29. item fields are accessible inside the body", () => {
    const intake = makeIntake({ children: [{ full_name: "Tommy", date_of_birth: "2015-01-01", is_minor: true }] });
    expect(renderTemplate("{{#FOREACH children}}{{full_name}}{{/FOREACH}}", intake)).toBe("Tommy");
  });

  it("30. loop_index is 1-based and increments", () => {
    const intake = makeIntake({ children: [{ full_name: "A", date_of_birth: "", is_minor: false }, { full_name: "B", date_of_birth: "", is_minor: false }, { full_name: "C", date_of_birth: "", is_minor: false }] });
    expect(renderTemplate("{{#FOREACH children}}{{loop_index}}={{full_name}} {{/FOREACH}}", intake)).toBe("1=A 2=B 3=C ");
  });

  it("31. conditional inside FOREACH filters items", () => {
    const intake = makeIntake({
      children: [
        { full_name: "Minor1", date_of_birth: "2015-01-01", is_minor: true },
        { full_name: "Adult1", date_of_birth: "1990-01-01", is_minor: false },
        { full_name: "Minor2", date_of_birth: "2018-01-01", is_minor: true },
      ],
    });
    expect(renderTemplate("{{#FOREACH children}}{{#IF is_minor equals true}}{{full_name}};{{/IF}}{{/FOREACH}}", intake)).toBe("Minor1;Minor2;");
  });

  it("32. nested FOREACH works", () => {
    const intake = makeIntake({
      groups: [
        { name: "G1", members: [{ m: "a" }, { m: "b" }] },
        { name: "G2", members: [{ m: "c" }] },
      ],
    } as Record<string, unknown>);
    expect(renderTemplate("{{#FOREACH groups}}{{name}}:{{#FOREACH members}}{{m}}{{/FOREACH}};{{/FOREACH}}", intake)).toBe("G1:ab;G2:c;");
  });

  it("33. parent namespace remains accessible inside FOREACH", () => {
    const intake = makeIntake({ first_name: "John", last_name: "Smith", suffix: "None", children: [{ full_name: "Tommy", date_of_birth: "", is_minor: false }] });
    expect(renderTemplate("{{#FOREACH children}}{{client_full_name}}->{{full_name}}{{/FOREACH}}", intake)).toBe("John Smith->Tommy");
  });

  it("34. per-iteration item field shadows a top-level field of the same name", () => {
    const intake = makeIntake({
      first_name: "John",
      last_name: "Smith",
      suffix: "None",
      shadow_items: [{ client_full_name: "Override" }],
    } as Record<string, unknown>);
    // Top-level computed client_full_name is "John Smith"; the item shadows it.
    expect(renderTemplate("{{client_full_name}}|{{#FOREACH shadow_items}}{{client_full_name}}{{/FOREACH}}", intake)).toBe("John Smith|Override");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests with real WillIntake shapes
// ─────────────────────────────────────────────────────────────────────────────
describe("integration", () => {
  it("35. minimal intake renders a small mixed fragment", () => {
    const intake = makeIntake({
      first_name: "Jane",
      last_name: "Doe",
      suffix: "None",
      marital_status: "Single",
      has_children: false,
      children: [],
      personal_representative: { full_name: "Pat Rep", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(616) 555-1234" },
    });
    const tpl =
      "I, {{client_full_name}}, appoint {{personal_representative.full_name}}." +
      "{{#IF has_children equals true}} I have children.{{/IF}}" +
      "{{#FOREACH children}} child:{{full_name}}{{/FOREACH}}";
    expect(renderTemplate(tpl, intake)).toBe("I, Jane Doe, appoint Pat Rep.");
  });

  it("36. full intake exercises every conditional branch", () => {
    const intake = makeIntake({
      first_name: "Jane",
      middle_name: "Q",
      last_name: "Doe",
      suffix: "None",
      marital_status: "Married",
      spouse_full_name: "John Doe",
      has_children: true,
      has_minor_children: true,
      children: [
        { full_name: "Minor Kid", date_of_birth: "2015-01-01", is_minor: true },
        { full_name: "Adult Kid", date_of_birth: "1998-01-01", is_minor: false },
      ],
      specific_gifts: [{ item_description: "Ring", recipient_full_name: "Sue", recipient_relationship: "Sibling", fallback: "residuary" }],
      has_funeral_representative: true,
      funeral_representative: { full_name: "Fred Funeral", relationship: "Friend", phone: "(248) 555-1212" },
      intentional_exclusions: [{ full_name: "Black Sheep", relationship: "Former spouse" }],
      has_intentional_exclusions: true,
      dpoa_powers: ["banking", "real_estate"],
      hipaa_additional_authorized_parties: [{ full_name: "Spouse Doe", relationship: "Spouse" }],
      has_hipaa_additional_parties: true,
    });
    const tpl = [
      "{{#IF marital_status equals \"Married\"}}Spouse: {{spouse_full_name}}.{{/IF}}",
      "{{#IF has_children equals true}}Children:{{#FOREACH children}} {{full_name}}{{#IF is_minor equals true}}(minor){{/IF}};{{/FOREACH}}{{/IF}}",
      "{{#IF has_funeral_representative equals true}}FR: {{funeral_representative.full_name}}.{{/IF}}",
      "{{#IF dpoa_powers contains \"banking\"}}HasBanking{{/IF}}",
      "{{#IF dpoa_powers does_not_contain \"gift_making\"}};NoGift{{/IF}}",
      "{{#FOREACH specific_gifts}};Gift {{item_description}}->{{recipient_full_name}}{{/FOREACH}}",
      "{{#FOREACH intentional_exclusions}};Excl {{full_name}}{{/FOREACH}}",
      "{{#FOREACH hipaa_additional_authorized_parties}};HIPAA {{full_name}}{{/FOREACH}}",
    ].join("");
    const out = renderTemplate(tpl, intake);
    expect(out).toContain("Spouse: John Doe.");
    expect(out).toContain("Children: Minor Kid(minor); Adult Kid;");
    expect(out).toContain("FR: Fred Funeral.");
    expect(out).toContain("HasBanking");
    expect(out).toContain(";NoGift");
    expect(out).toContain(";Gift Ring->Sue");
    expect(out).toContain(";Excl Black Sheep");
    expect(out).toContain(";HIPAA Spouse Doe");
  });

  it("37. guardian_temporary_incapacity_authority true vs false yields different output", () => {
    const tpl =
      '{{#IF guardian_temporary_incapacity_authority equals true}}TEMP-AUTHORITY-GRANTED{{/IF}}' +
      '{{#IF guardian_temporary_incapacity_authority equals false}}TEMP-AUTHORITY-WITHHELD{{/IF}}';
    expect(renderTemplate(tpl, makeIntake({ guardian_temporary_incapacity_authority: true }))).toBe("TEMP-AUTHORITY-GRANTED");
    expect(renderTemplate(tpl, makeIntake({ guardian_temporary_incapacity_authority: false }))).toBe("TEMP-AUTHORITY-WITHHELD");
  });

  it("38. null successor_funeral_representative omits its IF block", () => {
    const tpl = "{{#IF successor_funeral_representative}}SUCC:{{successor_funeral_representative.full_name}}{{/IF}}";
    expect(renderTemplate(tpl, makeIntake({ successor_funeral_representative: null }))).toBe("");
    const withSucc = makeIntake({ successor_funeral_representative: { full_name: "Frida", relationship: "Friend", phone: "(517) 555-3434" } });
    expect(renderTemplate(tpl, withSucc)).toBe("SUCC:Frida");
  });

  it("loads a real template stub file and renders it", () => {
    const tpl = readFileSync(join(__dirname, "templates", "will-michigan-v1.1.0.txt"), "utf8");
    const out = renderTemplate(tpl, makeIntake({ first_name: "Jane", last_name: "Doe", suffix: "None" }));
    expect(out).toContain("JANE DOE");
    expect(out).not.toContain("{{");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────
describe("error handling", () => {
  it("39. unclosed IF throws with position context", () => {
    expect(() => renderTemplate("intro {{#IF has_children}} body", makeIntake())).toThrow(/Unclosed IF block/);
  });

  it("40. unclosed FOREACH throws", () => {
    expect(() => renderTemplate("intro {{#FOREACH children}} body", makeIntake())).toThrow(/Unclosed FOREACH block/);
  });

  it("41. mismatched nesting throws", () => {
    expect(() => renderTemplate('{{#IF has_children}}{{#FOREACH children}}{{/IF}}{{/FOREACH}}', makeIntake())).toThrow(/Mismatched nesting/);
  });

  it("42. merge variable not found lists available namespace keys", () => {
    let message = "";
    try {
      renderTemplate("{{nope_field}}", makeIntake());
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/Merge variable not found: \{\{nope_field\}\}/);
    expect(message).toMatch(/Available top-level keys:/);
    expect(message).toMatch(/first_name/); // a real key is listed
  });

  it("43. trailing/garbled tags throw a defensive error", () => {
    // `{{never_closed` has no closing braces, so the parser leaves it as literal text;
    // the defensive post-check catches it.
    expect(() => renderTemplate("hello {{never_closed", makeIntake())).toThrow(/Trailing template tags/);
  });

  it("unrecognized block tag (e.g. {{#ELSE}}) throws", () => {
    expect(() => renderTemplate("{{#IF has_children}}a{{#ELSE}}b{{/IF}}", makeIntake())).toThrow(/Unrecognized block tag/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeDerivedFields direct unit checks
// ─────────────────────────────────────────────────────────────────────────────
describe("computeDerivedFields", () => {
  it("marital_status_label passes through known statuses", () => {
    expect(computeDerivedFields(makeIntake({ marital_status: "Married" })).marital_status_label).toBe("Married");
    expect(computeDerivedFields(makeIntake({ marital_status: "Widowed" })).marital_status_label).toBe("Widowed");
  });

  it("not_empty flags reflect array contents", () => {
    const empty = computeDerivedFields(makeIntake());
    expect(empty.contingent_beneficiaries_not_empty).toBe(false);
    expect(empty.hipaa_additional_authorized_parties_not_empty).toBe(false);
    const filled = computeDerivedFields(
      makeIntake({
        contingent_beneficiaries: [{ full_name: "C", relationship: "Child", share_percent: "100" }],
        hipaa_additional_authorized_parties: [{ full_name: "P", relationship: "Spouse" }],
      })
    );
    expect(filled.contingent_beneficiaries_not_empty).toBe(true);
    expect(filled.hipaa_additional_authorized_parties_not_empty).toBe(true);
  });
});
