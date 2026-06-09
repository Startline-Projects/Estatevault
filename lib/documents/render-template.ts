import type { TemplateWillIntake as WillIntake } from "./intake-adapter";
import { computeDerivedFields } from "./computed-fields";

/**
 * A lookup namespace: a flat record keyed by field name. Values may be any JSON-ish
 * shape (strings, numbers, booleans, nested objects, arrays).
 */
type Namespace = Record<string, unknown>;

/** Plain literal text between tags. */
interface TextNode {
  kind: "text";
  text: string;
}
/** A `{{merge_variable}}` token. */
interface VarNode {
  kind: "var";
  name: string;
  index: number;
}
/** A `{{#IF condition}}...{{/IF}}` block. */
interface IfNode {
  kind: "if";
  condition: string;
  body: TemplateNode[];
  index: number;
}
/** A `{{#FOREACH array_path}}...{{/FOREACH}}` block. */
interface ForeachNode {
  kind: "foreach";
  arrayPath: string;
  body: TemplateNode[];
  index: number;
}
type TemplateNode = TextNode | VarNode | IfNode | ForeachNode;

/** Matches a single `{{ ... }}` tag. Tag bodies may not themselves contain braces. */
const TAG_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

/**
 * Build a short, human-readable context snippet for error messages: ~25 characters
 * of template text on either side of `index`, plus the offset.
 */
function context(template: string, index: number): string {
  const start = Math.max(0, index - 25);
  const end = Math.min(template.length, index + 25);
  return `\n  near (offset ${index}): "…${template.slice(start, end)}…"`;
}

/**
 * Parse a template string into an AST of {@link TemplateNode}s. A stack tracks open
 * IF/FOREACH blocks so arbitrary nesting is handled, and mismatched/unclosed blocks
 * produce clear errors.
 *
 * @param template - The raw template text.
 * @returns The list of top-level nodes.
 * @throws If a block is unclosed, a closing tag has no matching open tag, nesting is
 *   mismatched, or an unrecognized `#`/`/` block tag is encountered.
 */
function parseTemplate(template: string): TemplateNode[] {
  const root: TemplateNode[] = [];
  // Each frame holds the children array currently being appended to, plus the block
  // node that owns it (null for the root frame).
  const stack: Array<{ block: IfNode | ForeachNode | null; children: TemplateNode[] }> = [
    { block: null, children: root },
  ];
  const top = () => stack[stack.length - 1];

  let lastIndex = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(template)) !== null) {
    const full = m[0];
    const inner = m[1].trim();
    const idx = m.index;

    if (idx > lastIndex) {
      top().children.push({ kind: "text", text: template.slice(lastIndex, idx) });
    }

    if (inner.startsWith("#")) {
      if (inner === "#IF" || inner.startsWith("#IF ")) {
        const node: IfNode = { kind: "if", condition: inner === "#IF" ? "" : inner.slice(4).trim(), body: [], index: idx };
        top().children.push(node);
        stack.push({ block: node, children: node.body });
      } else if (inner === "#FOREACH" || inner.startsWith("#FOREACH ")) {
        const node: ForeachNode = { kind: "foreach", arrayPath: inner === "#FOREACH" ? "" : inner.slice(9).trim(), body: [], index: idx };
        top().children.push(node);
        stack.push({ block: node, children: node.body });
      } else {
        throw new Error(`Unrecognized block tag: {{${inner}}}${context(template, idx)}`);
      }
    } else if (inner.startsWith("/")) {
      const expecting = inner === "/IF" ? "if" : inner === "/FOREACH" ? "foreach" : null;
      if (!expecting) {
        throw new Error(`Unrecognized closing tag: {{${inner}}}${context(template, idx)}`);
      }
      const frame = top();
      if (!frame.block) {
        throw new Error(`Closing tag {{${inner}}} has no matching opening tag.${context(template, idx)}`);
      }
      if (frame.block.kind !== expecting) {
        throw new Error(
          `Mismatched nesting: found {{${inner}}} but the open block is {{#${frame.block.kind.toUpperCase()}}} ` +
            `(opened at offset ${frame.block.index}).${context(template, idx)}`
        );
      }
      stack.pop();
    } else {
      top().children.push({ kind: "var", name: inner, index: idx });
    }

    lastIndex = idx + full.length;
  }

  if (lastIndex < template.length) {
    top().children.push({ kind: "text", text: template.slice(lastIndex) });
  }

  if (stack.length > 1) {
    const open = stack[stack.length - 1].block as IfNode | ForeachNode;
    throw new Error(
      `Unclosed ${open.kind.toUpperCase()} block (opened at offset ${open.index}).${context(template, open.index)}`
    );
  }

  return root;
}

/**
 * Resolve a dot-notation path against a namespace, leniently: a missing key or a
 * null/undefined along the way yields `undefined` (never throws). Used for IF and
 * FOREACH path lookups, where an absent field is simply falsy/empty.
 */
function resolveLenient(ns: Namespace, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ns;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Truthiness rule for IF conditions: null, undefined, false, "", 0, and empty arrays
 * are falsy. Everything else (including non-empty arrays/objects and non-empty
 * strings) is truthy.
 */
function isTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === "" || v === 0) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number" && Number.isNaN(v)) return false;
  return Boolean(v);
}

/** Strip a single pair of surrounding double quotes from a string literal, if present. */
function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

/**
 * Evaluate an IF condition string against the namespace. Supported forms:
 * `field`, `field equals "str"`, `field equals true|false`,
 * `array contains "value"`, `array does_not_contain "value"`.
 *
 * @throws If the condition is empty or uses an unrecognized operator/shape.
 */
function evaluateCondition(condition: string, ns: Namespace, template: string, index: number): boolean {
  const c = condition.trim();
  if (!c) {
    throw new Error(`Unrecognized condition syntax (empty condition).${context(template, index)}`);
  }
  const tokens = c.split(/\s+/);

  if (tokens.length === 1) {
    return isTruthy(resolveLenient(ns, tokens[0]));
  }

  const field = tokens[0];
  const op = tokens[1];
  const operand = tokens.slice(2).join(" ");
  const value = resolveLenient(ns, field);

  if (op === "equals") {
    if (operand === "true") return value === true;
    if (operand === "false") return value === false;
    if (operand.startsWith('"') && operand.endsWith('"')) return value === stripQuotes(operand);
    throw new Error(
      `Unrecognized condition syntax: 'equals' operand must be a quoted string or true/false, got '${operand}'.${context(template, index)}`
    );
  }
  if (op === "contains") {
    const lit = stripQuotes(operand);
    return Array.isArray(value) && value.includes(lit);
  }
  if (op === "does_not_contain") {
    const lit = stripQuotes(operand);
    return !(Array.isArray(value) && value.includes(lit));
  }

  throw new Error(`Unrecognized condition syntax: unknown operator '${op}' in '${c}'.${context(template, index)}`);
}

/**
 * Resolve a merge variable. The FIRST path segment must exist as a key in the
 * namespace (a typo'd top-level variable fails fast); deeper segments resolving to
 * null/undefined yield an empty string.
 *
 * @throws If the top-level key is not present in the namespace.
 */
function evaluateVar(node: VarNode, ns: Namespace, template: string): string {
  const parts = node.name.split(".");
  if (!(parts[0] in ns)) {
    throw new Error(
      `Merge variable not found: {{${node.name}}}\n  Available top-level keys: ${Object.keys(ns).join(", ")}${context(template, node.index)}`
    );
  }
  let cur: unknown = ns[parts[0]];
  for (let i = 1; i < parts.length; i++) {
    if (cur === null || cur === undefined) {
      cur = undefined;
      break;
    }
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  if (cur === null || cur === undefined) return "";
  return typeof cur === "string" ? cur : String(cur);
}

/**
 * Recursively evaluate a list of AST nodes against a namespace, producing rendered
 * text. FOREACH iterates over an array (omitted entirely if the array is
 * missing/empty/non-array); IF renders its body only when the condition is true
 * (a false outer IF never evaluates its inner blocks).
 */
function evaluateNodes(nodes: TemplateNode[], ns: Namespace, template: string): string {
  let out = "";
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out += node.text;
        break;
      case "var":
        out += evaluateVar(node, ns, template);
        break;
      case "if":
        if (evaluateCondition(node.condition, ns, template, node.index)) {
          out += evaluateNodes(node.body, ns, template);
        }
        break;
      case "foreach": {
        const arr = resolveLenient(ns, node.arrayPath);
        if (Array.isArray(arr) && arr.length > 0) {
          arr.forEach((item, i) => {
            const perNs: Namespace = { ...ns, loop_index: i + 1 };
            if (item !== null && typeof item === "object" && !Array.isArray(item)) {
              Object.assign(perNs, item as Record<string, unknown>);
            } else {
              perNs.value = item;
            }
            out += evaluateNodes(node.body, perNs, template);
          });
        }
        break;
      }
    }
  }
  return out;
}

/**
 * Render a document template against a WillIntake, producing a fully-resolved string
 * ready for PDF generation. Supports merge variables (`{{field}}` / `{{a.b}}`),
 * conditional blocks (`{{#IF condition}}...{{/IF}}`), and loops
 * (`{{#FOREACH array}}...{{/FOREACH}}`), with computed/derived fields merged in.
 *
 * Pure, synchronous, no side effects.
 *
 * @param template - The raw template text.
 * @param intake - The WillIntake providing data for substitution.
 * @returns The rendered string with all tags resolved.
 * @throws On malformed templates (unclosed/mismatched blocks, bad conditions),
 *   unknown merge variables, or leftover tags after processing.
 */
export function renderTemplate(template: string, intake: WillIntake): string {
  const ns: Namespace = { ...(intake as unknown as Namespace), ...computeDerivedFields(intake) };
  const ast = parseTemplate(template);
  const out = evaluateNodes(ast, ns, template);

  // Defensive post-condition: no unprocessed tags should remain. A leftover `{{`
  // indicates an unclosed/garbled token the parser treated as literal text.
  if (/\{\{\s*[#/]?\s*[A-Za-z_]/.test(out)) {
    const idx = out.search(/\{\{\s*[#/]?\s*[A-Za-z_]/);
    throw new Error(`Trailing template tags remain after processing.${context(out, idx)}`);
  }

  return out;
}
