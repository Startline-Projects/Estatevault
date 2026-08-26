/*
 * Article and section auto-numbering with symbolic cross-references.
 *
 * Articles used to carry hardcoded roman numerals and sections hardcoded
 * "7.1" numbers. Any article or section wrapped in a conditional therefore left
 * a hole when it did not render: a will with no minor children jumped from
 * ARTICLE V to ARTICLE VII, and a trust with no second successor trustee jumped
 * from Section 3.2 to Section 3.4.
 *
 * Templates now declare articles and sections by stable symbolic id and let the
 * numerals be assigned at render time, from what actually rendered:
 *
 *   ## ARTICLE [[ARTICLE:trustee]] — TRUSTEE APPOINTMENT AND SUCCESSION
 *   ### Section [[SECTION:trustee.initial]] — Initial Trustee.
 *   ... as determined under Article [[REF:incapacity]] ...
 *   ### Section [[REF_NUM:gifts]].{{loop_index}}     (numbers built in a loop)
 *   ... the beneficiaries named in Section [[REF:distribution.primary]] ...
 *
 * A reference to something that did not render is an error, not a blank: the
 * template is wrong and should say so loudly rather than ship a will that
 * points at an article which is not there.
 */

const ARTICLE_RE = /\[\[ARTICLE:([A-Za-z0-9_]+)\]\]/g;
const SECTION_RE = /\[\[SECTION:([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\]\]/g;
const REF_RE = /\[\[REF:([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?)\]\]/g;
/** Arabic ordinal of an article, for section numbers built inside a FOREACH. */
const REF_NUM_RE = /\[\[REF_NUM:([A-Za-z0-9_]+)\]\]/g;
/** Any marker at all, used to detect leftovers. */
const ANY_MARKER_RE = /\[\[(ARTICLE|SECTION|REF|REF_NUM):[^\]]*\]\]/;

const ROMAN: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Cannot express ${n} as a roman numeral.`);
  let out = "";
  let rest = n;
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export interface NumberingResult {
  text: string;
  /** article id → roman numeral, in render order. */
  articles: Record<string, string>;
  /** "articleId.sectionId" → "3.2", in render order. */
  sections: Record<string, string>;
}

/**
 * Assigns numerals to whatever rendered and resolves every cross-reference.
 *
 * Pass 1 walks the text in order, numbering articles as they appear and
 * numbering sections within their own article. Pass 2 substitutes references.
 *
 * @throws If a section is declared for an article that never rendered, if a
 *   reference points at something that did not render, or if any marker
 *   survives the substitution.
 */
export function assignNumbering(text: string): NumberingResult {
  const articles: Record<string, string> = {};
  const articleOrdinals: Record<string, number> = {};
  const sections: Record<string, string> = {};
  const sectionCounts: Record<string, number> = {};

  // ── Pass 1: number declarations in order of appearance ──
  let articleCount = 0;
  const declarationRe = /\[\[ARTICLE:([A-Za-z0-9_]+)\]\]|\[\[SECTION:([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = declarationRe.exec(text)) !== null) {
    if (m[1] !== undefined) {
      const id = m[1];
      if (articles[id] === undefined) {
        articleCount += 1;
        articleOrdinals[id] = articleCount;
        articles[id] = toRoman(articleCount);
      }
      continue;
    }
    const articleId = m[2];
    const sectionId = m[3];
    const key = `${articleId}.${sectionId}`;
    if (articleOrdinals[articleId] === undefined) {
      throw new Error(
        `Section [[SECTION:${key}]] belongs to article "${articleId}", which did not render. ` +
          `A section cannot outlive its article — check the conditional that wraps them.`,
      );
    }
    if (sections[key] === undefined) {
      sectionCounts[articleId] = (sectionCounts[articleId] ?? 0) + 1;
      sections[key] = `${articleOrdinals[articleId]}.${sectionCounts[articleId]}`;
    }
  }

  // ── Pass 2: substitute ──
  let out = text
    .replace(ARTICLE_RE, (_all, id: string) => articles[id])
    .replace(SECTION_RE, (_all, a: string, sct: string) => sections[`${a}.${sct}`]);

  out = out.replace(REF_NUM_RE, (_all, id: string) => {
    const ordinal = articleOrdinals[id];
    if (ordinal === undefined) {
      throw new Error(`[[REF_NUM:${id}]] points at article "${id}", which did not render in this document.`);
    }
    return String(ordinal);
  });

  out = out.replace(REF_RE, (_all, id: string) => {
    const resolved = id.includes(".") ? sections[id] : articles[id];
    if (resolved === undefined) {
      const kind = id.includes(".") ? "section" : "article";
      throw new Error(
        `Cross-reference [[REF:${id}]] points at ${kind} "${id}", which did not render in this document. ` +
          `Either the reference belongs inside the same conditional as its target, or the target was removed.`,
      );
    }
    return resolved;
  });

  const leftover = out.match(ANY_MARKER_RE);
  if (leftover) {
    throw new Error(`Unresolved numbering marker after substitution: ${leftover[0]}`);
  }

  return { text: out, articles, sections };
}
