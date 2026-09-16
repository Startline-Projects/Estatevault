/**
 * Prompt 10B — the attorney's final two answers.
 *
 * 1. The client's own healthcare wishes now render in the Advance Healthcare
 *    Directive, under the attorney's lead-in sentence.
 * 2. The Will's "How to Sign This Will" sheet is the attorney's seven steps.
 *    Step 5 is the development team's correction, pending his decision, so it
 *    is asserted separately from the six verbatim steps.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderTemplate, stripComments } from "./render-template";
import { mapIntakeToTemplateData, validateForDocument } from "./intake-adapter";

const T = (name: string) => readFileSync(join(__dirname, "templates", name), "utf8");
const AHCD = T("advance-healthcare-directive-michigan-v1.0.0.txt");
const WILL = T("will-michigan-v1.1.0.txt");

const LEAD_IN =
  "In addition to the directives above, I want my healthcare agent and medical " +
  "providers to be aware of the following personal healthcare wishes and values:";

function intake(o: Record<string, unknown> = {}) {
  return {
    firstName: "Ahmed", lastName: "Hassan", city: "Dearborn Heights", state: "Michigan",
    executorName: "Raga Hassan", executorRelationship: "Spouse/Partner",
    patientAdvocateName: "Raga Hassan", patientAdvocateRelationship: "Spouse/Partner",
    successorTrusteeName: "Karim Hassan", successorTrusteeRelationship: "Sibling",
    beneficiaries: [{ name: "Layla Hassan", relationship: "Child", share: "", contingency: "descendants" }],
    organDonation: "silent",
    funeralPreference: "burial",
    isJointTrust: "No",
    ...o,
  };
}
const data = (o: Record<string, unknown> = {}) => mapIntakeToTemplateData(intake(o)).data!;
const ahcd = (o: Record<string, unknown> = {}) => renderTemplate(AHCD, data(o));

/** Section 2.11, from its heading to the start of the next article. */
function statementSection(out: string): string {
  const start = out.indexOf("— Statement of Limitations");
  expect(start).toBeGreaterThan(-1);
  const end = out.indexOf("## ARTICLE", start);
  return out.slice(start, end === -1 ? undefined : end);
}

describe("the client's healthcare wishes reach the directive", () => {
  const WISHES = "I wish to remain at home for as long as my care allows.";

  it("renders them under the attorney's lead-in, inside the Statement of Limitations section", () => {
    const section = statementSection(ahcd({ hasHealthcareWishes: "Yes", healthcareWishesDescription: WISHES }));
    expect(section).toContain(LEAD_IN);
    expect(section).toContain(WISHES);
    expect(section.indexOf(LEAD_IN)).toBeLessThan(section.indexOf(WISHES));
  });

  it("carries the client's words verbatim, punctuation included", () => {
    const odd = 'Keep me comfortable — no machines, "no heroics", and let my family stay. Amen.';
    const out = ahcd({ hasHealthcareWishes: "Yes", healthcareWishesDescription: odd });
    expect(out).toContain(odd);
  });

  it("preserves a multi-paragraph instruction as written", () => {
    const two = "First, keep me comfortable.\n\nSecond, let my daughter decide the rest.";
    const out = ahcd({ hasHealthcareWishes: "Yes", healthcareWishesDescription: two });
    expect(out).toContain("First, keep me comfortable.");
    expect(out).toContain("Second, let my daughter decide the rest.");
  });

  it("renders neither the lead-in nor a stray paragraph when there are no wishes", () => {
    const out = ahcd({ hasHealthcareWishes: "No", healthcareWishesDescription: "" });
    expect(out).not.toContain(LEAD_IN);
    expect(out).not.toContain("healthcare agent");
    // the section still ends on the attorney's own closing paragraph
    expect(statementSection(out).trimEnd()).toMatch(/substituted judgment in those unforeseen circumstances\.$/);
  });

  it("treats whitespace-only wishes as no wishes", () => {
    expect(ahcd({ hasHealthcareWishes: "Yes", healthcareWishesDescription: "   \n  " }))
      .not.toContain(LEAD_IN);
  });

  it("does not block a directive that has wishes — it renders them", () => {
    const d = data({ hasHealthcareWishes: "Yes", healthcareWishesDescription: WISHES });
    expect(validateForDocument("ahcd", d)).toEqual([]);
    expect(validateForDocument("pad", d)).toEqual([]);
  });

  it("keeps the wishes out of every other document", () => {
    expect(renderTemplate(WILL, data({ hasHealthcareWishes: "Yes", healthcareWishesDescription: WISHES })))
      .not.toContain(WISHES);
  });
});

describe("the Will's How to Sign sheet is the attorney's", () => {
  const out = () => renderTemplate(WILL, data());

  const VERBATIM = [
    "Important: To make this Will legally valid under Michigan law, you must follow each step below carefully. Failure to follow these steps exactly may render your Will invalid and unenforceable.",
    "STEP 1 - Gather Your Materials",
    "Print this Will on plain white paper. Do not sign until you have completed all the following steps.",
    "STEP 2 - Sign in Front of Two Witnesses and a Notary Public",
    "You, both witnesses, and a notary public must all be physically present together at the same time. Sign your name at the end of this Will exactly as it appears in the opening paragraph. Your two witnesses and notary must watch you sign.",
    "STEP 3 - Witnesses Sign",
    "Immediately after you sign, both witnesses must sign their names and provide their full addresses on the signature page. Witnesses should not be beneficiaries under this Will.",
    "STEP 4 - Notary Signs and Seals",
    "The notary public must sign, date, and affix their official seal to the signature page while all parties are still present together.",
    "STEP 6 - Store Your Original Safely",
    "Store your original signed Will in a safe place, such as a safe deposit box, fireproof safe, or with your Personal Representative. Do not store it where it might be damaged, lost, or mistaken for a draft. You may also upload a copy to your EstateVault account for safekeeping.",
    "STEP 7 - Inform Your Personal Representative",
    "Inform your Personal Representative (the person you named to carry out your Will) where this original Will is stored and provide them with a copy. Give them any password or access information they may need to locate it.",
  ];

  it.each(VERBATIM)("renders verbatim: %s", (text) => {
    expect(out()).toContain(text);
  });

  it("keeps the steps in order", () => {
    const o = out();
    const positions = ["STEP 1 -", "STEP 2 -", "STEP 3 -", "STEP 4 -", "STEP 5 -", "STEP 6 -", "STEP 7 -"]
      .map((s) => o.indexOf(s));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("replaced the development team's steps entirely", () => {
    const o = out();
    for (const gone of [
      "STEP 1 - CHOOSE YOUR WITNESSES",
      "STEP 5 - COMPLETE THE NOTARY SECTION",
      "Sign and date this Will in the presence of both witnesses simultaneously.",
      "Do not store the original where your Personal Representative cannot reach it without a court order.",
    ]) {
      expect(o).not.toContain(gone);
    }
  });

  it("Step 5 is the corrected version, not the one that sends clients for a second affidavit", () => {
    const o = out();
    expect(o).toContain("STEP 5 - Complete the Self-Proving Affidavit (Strongly Recommended)");
    expect(o).toContain(
      "This Will includes a self-proving affidavit on its final pages. You, your witnesses, and the notary complete it during the same signing session. This makes it easier for your Personal Representative to probate your Will without requiring witness testimony later."
    );
    expect(o).not.toMatch(/ask (the|your) notary to prepare/i);
  });

  it("the Will it describes does carry the affidavit Step 5 points at", () => {
    const o = out();
    expect(o).toContain("MCL 700.2504");
    expect(o.indexOf("STATE OF MICHIGAN")).toBeLessThan(o.indexOf("STEP 5 -"));
  });

  it("leaves no comment in the delivered document", () => {
    const o = out();
    expect(o).not.toContain("{{!--");
    expect(o).not.toContain("--}}");
    // the comment is in the source and never in the output
    expect(WILL).toContain("{{!--");
    expect(WILL).toContain("Mo Murshed's text, integrated verbatim");
  });

  it("Step 5 is now final, not held", () => {
    expect(WILL).not.toContain("PENDING ATTORNEY APPROVAL");
    expect(WILL).toContain("he approved it as written on 2026-09-13");
  });
});

describe("template comments", () => {
  it("are removed whole, taking their own line with them", () => {
    const src = "before\n\n{{!-- a note --}}\nafter\n";
    expect(stripComments(src)).toBe("before\n\nafter\n");
  });

  it("span lines", () => {
    expect(stripComments("a\n{{!--\nline one\nline two\n--}}\nb\n")).toBe("a\nb\n");
  });

  it("can sit inline without eating the line", () => {
    expect(stripComments("keep {{!-- drop --}}this")).toBe("keep this");
  });

  it("leave a template with no comments untouched", () => {
    const src = "## ARTICLE I — X\n\n{{name}} signs.\n";
    expect(stripComments(src)).toBe(src);
  });
});

describe("the citation sweep left no dangling fragments", () => {
  it.each([
    ["will-michigan-v1.1.0.txt", "State of Michigan · Michigan EPIC"],
    ["dpoa-michigan-v1.1.0.txt", "State of Michigan · Michigan Uniform Power of Attorney Act"],
    ["pour-over-will-michigan-v1.1.0.txt", "State of Michigan · Michigan EPIC"],
  ])("%s closes its framework line without a trailing comma", (file, line) => {
    const text = T(file);
    expect(text).toContain(line + "\n");
    expect(text).not.toContain(line + ",");
  });

  it("no template line ends on a comma", () => {
    for (const f of [
      "will-michigan-v1.1.0.txt", "dpoa-michigan-v1.1.0.txt", "pour-over-will-michigan-v1.1.0.txt",
      "trust-michigan-v1.1.0.txt", "advance-healthcare-directive-michigan-v1.0.0.txt",
    ]) {
      // comments never reach a client, so they are not document lines
      const dangling = stripComments(T(f)).split("\n").filter((l) => /,$/.test(l.trim()));
      expect(dangling, `${f}: ${dangling.join(" | ")}`).toEqual([]);
    }
  });
});

describe("a client's own words are data, never template syntax", () => {
  const wish = (text: string) =>
    renderTemplate(AHCD, data({ hasHealthcareWishes: "Yes", healthcareWishesDescription: text }));
  const sectionNumbers = (out: string) =>
    (out.match(/^### Section \d+\.\d+/gm) ?? []).join(",");

  const BASELINE = sectionNumbers(renderTemplate(AHCD, data()));

  it.each([
    ["an article marker", "I want [[ARTICLE:sneaky]] to be comfortable."],
    ["a section marker", "Please see [[SECTION:health_powers.s99|pad2]] for details."],
    ["a cross-reference", "As stated in [[REF:nope]], keep me at home."],
    ["a reference numeral", "See [[REF_NUM:health_powers]]."],
  ])("%s in the client's text does not touch the document's numbering", (_label, text) => {
    const out = wish(text);
    expect(sectionNumbers(out)).toBe(BASELINE);
    expect(out).toContain(text);
  });

  it.each([
    ["a merge field", "Please tell {{client_full_name}} I love them."],
    ["a conditional", '{{#IF organ_donation equals "silent"}}hidden{{/IF}}'],
    ["a bare brace", "Ask {{my daughter first."],
  ])("%s renders as the characters the client typed, and does not fail the document", (_label, text) => {
    const out = wish(text);
    expect(out).toContain(text);
  });

  it("does not resolve a merge field a client typed", () => {
    const out = wish("Tell {{client_full_name}} I love them.");
    expect(out).toContain("{{client_full_name}}");
    expect(out).not.toContain("Tell Ahmed Hassan I love them.");
  });

  it("still fails a template whose own tags were garbled", () => {
    // An unclosed IF the parser treated as literal text: the tag survives into
    // the output and the post-condition catches it. Template integrity is still
    // checked; only client data is exempt.
    expect(() => renderTemplate("Hello {{#IF broken\n\nplain text\n", data()))
      .toThrow(/Trailing template tags remain/);
  });

  it("leaves no sentinel characters in the output", () => {
    const out = wish("Mixed [[ARTICLE:x]] and {{var}} and ]] and }}.");
    expect(out).not.toMatch(/[-]/);
    expect(out).toContain("Mixed [[ARTICLE:x]] and {{var}} and ]] and }}.");
  });

  it("keeps the template's own markers working", () => {
    const out = wish("Keep me comfortable.");
    expect(out).not.toContain("[[");
    expect(out).toMatch(/## ARTICLE (One|Two|Three|Four) —/);
  });
});
