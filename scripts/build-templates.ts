/**
 * Generates lib/documents/templates/<name>.ts from <name>.txt.
 *
 * The .txt files are the single source of truth — they are what an attorney
 * reviews and edits. The .ts files exist only because Next.js bundles imports
 * but cannot read arbitrary files from disk at runtime on Vercel, so
 * template-reader.ts imports the .ts wrapper.
 *
 * Usage:
 *   tsx scripts/build-templates.ts           regenerate the .ts wrappers
 *   tsx scripts/build-templates.ts --check   fail if any wrapper is stale
 *
 * `--check` runs in prebuild, so a .txt edit that was never rebuilt fails the
 * build instead of silently shipping the previous text.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const TEMPLATE_DIR = join(process.cwd(), "lib", "documents", "templates");
const BANNER = "// GENERATED FILE — do not edit. Source: ";

function wrap(txtName: string, body: string): string {
  // Templates are plain legal prose; verified free of backticks and ${.
  if (body.includes("`") || body.includes("${")) {
    throw new Error(`${txtName} contains a backtick or \${ and cannot be embedded verbatim.`);
  }
  return `${BANNER}${txtName}\n// Regenerate with: npm run templates:build\n\nconst template = \`\n${body}\`;\n\nexport default template;\n`;
}

function main() {
  const check = process.argv.includes("--check");
  const txtFiles = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".txt")).sort();

  if (txtFiles.length === 0) {
    console.error("No .txt templates found in", TEMPLATE_DIR);
    process.exit(1);
  }

  const stale: string[] = [];
  for (const txt of txtFiles) {
    const tsName = txt.replace(/\.txt$/, ".ts");
    const tsPath = join(TEMPLATE_DIR, tsName);
    const expected = wrap(txt, readFileSync(join(TEMPLATE_DIR, txt), "utf8"));

    if (check) {
      const actual = existsSync(tsPath) ? readFileSync(tsPath, "utf8") : "";
      if (actual !== expected) stale.push(tsName);
    } else {
      writeFileSync(tsPath, expected);
      console.log(`  ✓ ${tsName}`);
    }
  }

  if (check) {
    if (stale.length > 0) {
      console.error("Template wrappers are stale (a .txt was edited without rebuilding):");
      stale.forEach((f) => console.error(`  ✗ ${f}`));
      console.error("\nRun: npm run templates:build");
      process.exit(1);
    }
    console.log(`✓ all ${txtFiles.length} template wrappers are current`);
  } else {
    console.log(`\nGenerated ${txtFiles.length} template wrappers from .txt sources.`);
  }
}

main();
