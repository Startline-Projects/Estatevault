import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate } from "./render-template";
import { initialTemplateWillIntake as initialWillIntake, type TemplateWillIntake as WillIntake } from "./intake-adapter";

/**
 * INTEGRATION TESTS — render Mike's six approved Michigan templates with a
 * realistic, fully-populated intake and assert end-to-end invariants. Unit
 * tests in render-template.test.ts cover the resolver primitives; these tests
 * cover the actual production .txt files in lib/documents/templates/.
 *
 * Each test asserts:
 *   - client name (or its uppercase form) appears in the output,
 *   - at least one structural marker (## ARTICLE / ## SECTION / ### Section /
 *     [NOTARY_BLOCK] / [SIGNATURE]) is present,
 *   - no leftover `{{...}}` tokens of any kind remain after rendering,
 *   - no leftover IF/FOREACH open/close tags remain,
 *   - the conditional branches that should have been taken (based on the
 *     intake fixture) are visible, and the branches that should have been
 *     skipped are absent,
 *   - FOREACH-driven content (children, beneficiaries, etc.) is rendered.
 */

const TEMPLATES_DIR = join(__dirname, "templates");

/** Read a template file by base name (no extension). */
function loadTemplate(baseName: string): string {
  return readFileSync(join(TEMPLATES_DIR, `${baseName}.txt`), "utf8");
}

/**
 * Build a fully populated WillIntake covering all the conditional branches the
 * templates exercise. JSON round-trip clones initial defaults so per-test
 * mutations cannot leak across tests.
 */
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
    contingent_beneficiaries: [
      { full_name: "Carol Adams", relationship: "sister", share_percent: "100" },
    ],

    guardian: { full_name: "Carol Adams", relationship: "Aunt", city: "Grand Rapids", state: "Michigan", phone: "(616) 555-3434" },
    successor_guardian: { full_name: "Dan Adams", relationship: "Uncle" },
    standby_guardian: null,

    has_specific_gifts: true,
    specific_gifts: [
      { item_description: "my grandmother's wedding ring", recipient_full_name: "Alice Public", recipient_relationship: "daughter", fallback: "residuary" },
      { item_description: "my vintage record collection", recipient_full_name: "Bob Public", recipient_relationship: "son", fallback: "to_children" },
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

    dpoa_agent: { full_name: "Mark Smith", relationship: "Brother", city: "Ann Arbor", state: "Michigan", phone: "(734) 555-1212" },
    first_successor_dpoa_agent: { full_name: "Sue Doe", relationship: "Sister", city: "Lansing", state: "Michigan", phone: "(517) 555-3333" },
    second_successor_dpoa_agent: { full_name: "Karen Lee", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-4444" },
    dpoa_effective: "immediate",
    dpoa_agent_compensation: "reasonable",

    patient_advocate: { full_name: "Ed Brown", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-9999" },
    successor_patient_advocate: { full_name: "Fay Green", relationship: "Friend", city: "Detroit", state: "Michigan", phone: "(313) 555-1234" },
    life_sustaining_treatment_preference: "withhold_if_terminal_or_pvs",
    artificial_nutrition_preference: "withhold_if_terminal_or_pvs",

    has_hipaa_additional_parties: true,
    hipaa_additional_authorized_parties: [
      { full_name: "Carol Adams", relationship: "sister" },
      { full_name: "Greg Hall", relationship: "brother" },
    ],
  };
}

/**
 * Common post-render invariants. Asserts no surviving `{{...}}` tokens (which
 * would mean a merge variable or control tag escaped resolution) and that the
 * output has the basic shape we expect.
 */
function assertFullyResolved(rendered: string) {
  // Any remaining `{{` indicates an unresolved variable or unclosed block.
  expect(rendered, "no `{{...}}` tokens should remain").not.toMatch(/\{\{/);
  // Specifically check for unclosed IF/FOREACH (would already be caught above,
  // but a targeted assertion gives a clearer failure message).
  expect(rendered, "no IF tags should remain").not.toMatch(/\{\{\s*#?\s*\/?\s*IF/);
  expect(rendered, "no FOREACH tags should remain").not.toMatch(/\{\{\s*#?\s*\/?\s*FOREACH/);
  // Sanity: non-empty.
  expect(rendered.length).toBeGreaterThan(500);
}

describe("template integration — will-michigan-v1.1.0", () => {
  it("renders client name, articles, both children, gifts, and the correct branches", () => {
    const tpl = loadTemplate("will-michigan-v1.1.0");
    const out = renderTemplate(tpl, realisticIntake());
    assertFullyResolved(out);

    // Client identity
    expect(out).toContain("JANE QUINCY PUBLIC");
    expect(out).toContain("Jane Quincy Public");

    // Structural markers
    expect(out).toMatch(/^## ARTICLE I —/m);
    expect(out).toMatch(/^### Section 1\.1 —/m);
    expect(out).toContain("[NOTARY_BLOCK]");
    expect(out).toContain("[/NOTARY_BLOCK]");

    // Married branch chosen, others skipped
    expect(out).toContain('My spouse is John Public');
    expect(out).not.toContain("I am single. I am not currently married");

    // Children FOREACH expanded for both kids
    expect(out).toContain("Alice Public, born on 2010-06-01");
    expect(out).toContain("Bob Public, born on 2008-08-22");

    // Specific gifts FOREACH with per-iteration loop_index and fallback branch
    expect(out).toContain("Section 4.1");
    expect(out).toContain("Section 4.2");
    expect(out).toContain("my grandmother's wedding ring");
    expect(out).toContain("my vintage record collection");
    expect(out).toContain("this gift shall lapse and become part of my residuary estate");
    expect(out).toContain("this gift shall pass to the then-living children of the recipient");

    // Guardian article gated by has_minor_children = true
    expect(out).toMatch(/ARTICLE VI[ \t]*—[ \t]*GUARDIAN FOR MINOR CHILDREN/);
    expect(out).toContain("Carol Adams");
    // Temporary-incapacity authority granted branch
    expect(out).toContain("MCL 700.5204");

    // Final wishes — organ donation yes_all branch chosen
    expect(out).toContain("authorize the donation of any of my organs");
    // funeral_preference = burial
    expect(out).toContain("interred by burial");

    // No-contest clause (default true) present
    expect(out).toContain("If any beneficiary under this Will");
  });
});

describe("template integration — dpoa-michigan-v1.1.0", () => {
  it("renders agents, immediate-effect branch, granted/withheld powers, and reasonable comp", () => {
    const tpl = loadTemplate("dpoa-michigan-v1.1.0");
    const out = renderTemplate(tpl, realisticIntake());
    assertFullyResolved(out);

    expect(out).toContain("JANE QUINCY PUBLIC");
    expect(out).toMatch(/^## ARTICLE I —/m);

    // Three agents present
    expect(out).toContain("Mark Smith"); // primary
    expect(out).toContain("Sue Doe"); // first successor
    expect(out).toContain("Karen Lee"); // second successor

    // Effective branch: immediate (not springing)
    expect(out).toContain("effective immediately upon execution");
    expect(out).not.toContain('"springing" power of attorney');

    // Default powers (8 of them) — all GRANTED
    expect(out).toContain("Banking and Financial Institution Transactions.  GRANTED.");
    expect(out).toContain("Real Estate Transactions.  GRANTED.");
    expect(out).toContain("Digital Assets.  GRANTED.");

    // Hot powers default = NOT GRANTED (gift_making + amend_estate_plan absent from defaults)
    expect(out).toContain("Gift-Making Authority.  NOT GRANTED.");
    expect(out).toContain("Authority to Make Changes to Estate Plan.  NOT GRANTED.");

    // Compensation = reasonable
    expect(out).toContain('"Reasonable compensation" shall be determined');
    expect(out).not.toContain("shall serve without compensation");

    // Notary block wrapper
    expect(out).toContain("[NOTARY_BLOCK]");
    expect(out).toContain("[/NOTARY_BLOCK]");
  });
});

describe("template integration — pad-michigan-v1.1.0", () => {
  it("renders patient advocates, treatment preference branches, and HIPAA parties", () => {
    const tpl = loadTemplate("pad-michigan-v1.1.0");
    const out = renderTemplate(tpl, realisticIntake());
    assertFullyResolved(out);

    expect(out).toContain("JANE QUINCY PUBLIC");
    expect(out).toMatch(/^## ARTICLE I —/m);

    // Patient advocate + successor
    expect(out).toContain("Ed Brown");
    expect(out).toContain("Fay Green");

    // Life-sustaining preference = withhold_if_terminal_or_pvs (branch taken)
    expect(out).toContain("Withhold if Terminal Condition or Persistent Vegetative State");
    // Continue-all branch NOT taken
    expect(out).not.toContain("all reasonable measures be taken to extend my life");

    // Artificial nutrition = withhold_if_terminal_or_pvs
    expect(out).toContain("withholding or withdrawal of artificial nutrition and hydration");

    // Pain management default = provide_even_if_shortens
    expect(out).toContain("Provide Pain Relief Even if Life-Shortening");

    // Pregnancy exclusion default = no_pregnancy_restriction
    expect(out).toContain("No Additional Pregnancy Restriction");

    // Mental health treatment authority = true → GRANTED
    expect(out).toContain("Mental Health Treatment Authority.  GRANTED.");

    // HIPAA additional parties FOREACH expanded
    expect(out).toContain("Carol Adams, my sister");
    expect(out).toContain("Greg Hall, my brother");

    // Organ donation yes_all
    expect(out).toContain("authorize the donation of any of my organs");
  });
});

describe("template integration — hipaa-authorization-v1.1.0", () => {
  it("renders patient identity, HIPAA expiration date, and FOREACH additional parties", () => {
    const tpl = loadTemplate("hipaa-authorization-v1.1.0");
    const out = renderTemplate(tpl, realisticIntake());
    assertFullyResolved(out);

    expect(out).toContain("Jane Quincy Public");
    // HIPAA-style numbered sections promoted
    expect(out).toMatch(/^## SECTION 1 —/m);
    expect(out).toMatch(/^### 1\.1 —/m);

    // Patient advocate + successor as the always-authorized recipients
    expect(out).toContain("Ed Brown");
    expect(out).toContain("Fay Green");

    // Additional authorized parties FOREACH expanded
    expect(out).toContain("Carol Adams, my sister");
    expect(out).toContain("Greg Hall, my brother");

    // Expiration date is "today + 7 years" — must be a long-format date string
    // ending in a 4-digit year. Don't pin the year exactly (tests shouldn't
    // depend on real-time clock) but check the shape.
    expect(out).toMatch(/This authorization expires on [A-Z][a-z]+ \d{1,2}, \d{4}/);

    // Notary block wrapper
    expect(out).toContain("[NOTARY_BLOCK]");
    expect(out).toContain("[/NOTARY_BLOCK]");
  });
});

describe("template integration — funeral-rep-michigan-v1.0.0", () => {
  it("renders declarant, primary + successor reps, burial preference, and inline IF for successor", () => {
    const tpl = loadTemplate("funeral-rep-michigan-v1.0.0");
    const out = renderTemplate(tpl, realisticIntake());
    assertFullyResolved(out);

    expect(out).toContain("Jane Quincy Public");
    expect(out).toMatch(/^## ARTICLE I —/m);

    // Funeral rep + successor (intake provides both)
    expect(out).toContain("Greg Hall");
    expect(out).toContain("Helen Hall");

    // Successor section (gated by IF successor_funeral_representative) present
    expect(out).toMatch(/Section 2\.2[^\n]*Successor Funeral Representative/);

    // Funeral preference = burial
    expect(out).toContain("MY ELECTED PREFERENCE  ·  Burial.");
    // Cremation branch NOT taken
    expect(out).not.toContain("MY ELECTED PREFERENCE  ·  Cremation.");

    // Statutory authority bolded reference visible
    expect(out).toContain("MCL 700.3206");
  });

  it("omits successor block when successor_funeral_representative is null", () => {
    const tpl = loadTemplate("funeral-rep-michigan-v1.0.0");
    const intake = realisticIntake();
    intake.successor_funeral_representative = null;
    const out = renderTemplate(tpl, intake);
    assertFullyResolved(out);

    // Section 2.2 (successor) should be entirely gone
    expect(out).not.toMatch(/Section 2\.2[^\n]*Successor Funeral Representative/);
    // But the primary funeral rep is still there
    expect(out).toContain("Greg Hall");
  });
});

describe("template integration — guardian-nomination-michigan-v1.0.0", () => {
  it("renders nominating parent, minor children FOREACH+IF, and temporary-incapacity branch", () => {
    const tpl = loadTemplate("guardian-nomination-michigan-v1.0.0");
    const out = renderTemplate(tpl, realisticIntake());
    assertFullyResolved(out);

    expect(out).toContain("Jane Quincy Public");
    expect(out).toMatch(/^## ARTICLE I —/m);

    // Guardian + successor identities (with full address per personSchema5)
    expect(out).toContain("Carol Adams");
    expect(out).toContain("Grand Rapids");
    expect(out).toContain("Dan Adams");

    // Children FOREACH with inner IF is_minor=true — both Alice and Bob are minors
    expect(out).toContain("Alice Public, born on 2010-06-01");
    expect(out).toContain("Bob Public, born on 2008-08-22");

    // Temporary-incapacity authority branch = true → MCL 700.5204 lifetime block
    expect(out).toContain("MCL 700.5204");
    expect(out).toContain("temporarily unable to care for my minor children");

    // Standby guardian block absent (standby_guardian is null)
    expect(out).not.toMatch(/Section 3\.3[^\n]*Standby Guardian/);

    // Notary block wrapper
    expect(out).toContain("[NOTARY_BLOCK]");
    expect(out).toContain("[/NOTARY_BLOCK]");
  });
});
