import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import {
  ArticleHeader,
  SectionHeader,
  BodyText,
  BulletItem,
  InfoBox,
  CalloutAmber,
  CalloutNavy,
  CalloutGreen,
  CalloutRed,
  PreferenceCard,
  PowerIndicator,
  SignatureBlock,
  NotaryBlock,
  CoverTitle,
  CoverSubtitle,
  BoldStatutory,
  BrandedHeader,
  BrandedFooter,
} from "./index";

/**
 * Smoke tests — one per shipped component. We wrap each component in the
 * smallest viable Document/Page tree, render it to a PDF buffer, and assert
 * (1) the buffer is non-trivially sized and (2) starts with the `%PDF` magic
 * header. That proves the component produces a valid PDF without runtime
 * errors. Pixel-level visual checks belong in a downstream end-to-end test.
 *
 * The file deliberately uses `React.createElement` rather than JSX so the
 * existing vitest config (which `include`s only `**\/*.test.ts`) picks the
 * file up without configuration changes.
 */

const $ = React.createElement;

/** Render a single component inside a minimal Letter-sized Page and return the buffer. */
async function renderSmoke(node: React.ReactElement): Promise<Buffer> {
  const tree = $(Document, null, $(Page, { size: "LETTER" }, node));
  return await renderToBuffer(tree);
}

/** Assert: buffer is a non-trivial PDF. */
function assertValidPdf(buf: Buffer) {
  expect(buf.byteLength).toBeGreaterThan(1000);
  expect(buf.slice(0, 4).toString()).toBe("%PDF");
}

// Bump timeout to comfortably accommodate @react-pdf's layout + font loading
// on the first render (which is by far the slowest call).
const SMOKE_TIMEOUT = 30_000;

describe("PDF components: smoke", () => {
  it(
    "1. ArticleHeader renders to a valid PDF",
    async () => {
      const buf = await renderSmoke($(ArticleHeader, { number: "I", title: "IDENTIFICATION AND FAMILY" }));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "2. SectionHeader renders to a valid PDF",
    async () => {
      const buf = await renderSmoke($(SectionHeader, { number: "1.1", title: "Identification of Testator." }));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "3. BodyText renders to a valid PDF (including bold + italic inline runs)",
    async () => {
      const buf = await renderSmoke(
        $(BodyText, {
          text:
            "I, **Jane Q. Public**, a resident of the City of *Detroit*, do hereby make this Will. " +
            "This paragraph spans multiple sentences to exercise justification and inline emphasis.",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "4. BulletItem renders to a valid PDF",
    async () => {
      const buf = await renderSmoke($(BulletItem, { text: "Alice Public, born on 2010-06-01" }));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "5. InfoBox renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(InfoBox, {
          rows: [
            "**Testator:** Jane Q. Public  ·  Date of Birth: April 12, 1975",
            "**Residence:** 123 Maple Street, Detroit, Wayne County, Michigan  48201",
            "**Marital Status:** Married",
          ],
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "6. CalloutAmber renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(CalloutAmber, {
          label: "Important Information",
          text: "Read this document carefully before signing.",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "7. CalloutNavy renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(CalloutNavy, {
          label: "Operation of this document",
          text: "This document takes effect upon your death.",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "8. CalloutGreen renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(CalloutGreen, {
          label: "Attorney Reviewed & Approved",
          text: "Reviewing Attorney: Pat Reviewer, Bar No. 12345, Reviewed: 2026-05-31",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "9. CalloutRed renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(CalloutRed, {
          label: "Critical Notice to Witnesses",
          text: "A witness to this Patient Advocate Designation cannot be the Patient's spouse, parent, or child (MCL 700.5506(4)).",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "10. PreferenceCard renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(PreferenceCard, {
          label: "Burial.",
          text: "It is my preference that my remains be interred by burial.",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "11. PowerIndicator renders both granted and not_granted variants to valid PDFs",
    async () => {
      const granted = await renderSmoke(
        $(PowerIndicator, {
          powerName: "Banking",
          status: "granted",
          text: "The Agent is authorized to access and manage my bank accounts.",
        })
      );
      assertValidPdf(granted);

      const notGranted = await renderSmoke(
        $(PowerIndicator, {
          powerName: "Gift-Making",
          status: "not_granted",
          text: "The Agent is NOT authorized to make gifts of my property.",
        })
      );
      assertValidPdf(notGranted);
    },
    SMOKE_TIMEOUT
  );

  it(
    "12. SignatureBlock renders to a valid PDF",
    async () => {
      const buf = await renderSmoke($(SignatureBlock, { label: "Testator" }));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "13. NotaryBlock renders to a valid PDF (no props)",
    async () => {
      const buf = await renderSmoke($(NotaryBlock, null));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "14. CoverTitle renders to a valid PDF",
    async () => {
      const buf = await renderSmoke($(CoverTitle, { text: "LAST WILL AND TESTAMENT" }));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "15. CoverSubtitle renders to a valid PDF (input is uppercased automatically)",
    async () => {
      const buf = await renderSmoke($(CoverSubtitle, { text: "of Jane Q. Public" }));
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "16. BoldStatutory renders to a valid PDF",
    async () => {
      const buf = await renderSmoke(
        $(BoldStatutory, {
          text:
            "Pursuant to MCL 700.5202, upon my death, the Guardian shall have full authority to take physical custody of my minor children.",
        })
      );
      assertValidPdf(buf);
    },
    SMOKE_TIMEOUT
  );

  it(
    "17. BrandedHeader renders to a valid PDF (default EstateVault wordmark)",
    async () => {
      const buf = await renderSmoke(
        $(BrandedHeader, {
          isWhiteLabel: false,
          documentTitle: "LAST WILL AND TESTAMENT",
          templateVersion: "1.1.0",
        })
      );
      assertValidPdf(buf);

      // Also verify the white-label placeholder branch (no logo URL) renders.
      const whiteLabel = await renderSmoke(
        $(BrandedHeader, {
          isWhiteLabel: true,
          documentTitle: "LAST WILL AND TESTAMENT",
          templateVersion: "1.1.0",
        })
      );
      assertValidPdf(whiteLabel);
    },
    SMOKE_TIMEOUT
  );

  it(
    "18. BrandedFooter renders to a valid PDF (both default and white-label disclaimers)",
    async () => {
      const buf = await renderSmoke(
        $(BrandedFooter, {
          isWhiteLabel: false,
          clientFullName: "Jane Q. Public",
          documentTitle: "Last Will and Testament",
        })
      );
      assertValidPdf(buf);

      const whiteLabel = await renderSmoke(
        $(BrandedFooter, {
          isWhiteLabel: true,
          partnerName: "Acme Estate Planning",
          clientFullName: "Jane Q. Public",
          documentTitle: "Last Will and Testament",
        })
      );
      assertValidPdf(whiteLabel);
    },
    SMOKE_TIMEOUT
  );
});
