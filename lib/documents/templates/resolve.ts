import { TemplateBlockedError } from "@/lib/documents/generate-from-template";

export async function getTemplate(docType: string) {
  switch (docType) {
    case "will": {
      const { willSystemPrompt, buildWillPrompt } = await import("@/lib/documents/templates/michigan-will");
      return { systemPrompt: willSystemPrompt, buildPrompt: buildWillPrompt };
    }
    case "poa": {
      const { poaSystemPrompt, buildPOAPrompt } = await import("@/lib/documents/templates/michigan-poa");
      return { systemPrompt: poaSystemPrompt, buildPrompt: buildPOAPrompt };
    }
    case "healthcare_directive": {
      const { hcdSystemPrompt, buildHCDPrompt } = await import("@/lib/documents/templates/michigan-healthcare-directive");
      return { systemPrompt: hcdSystemPrompt, buildPrompt: buildHCDPrompt };
    }
    case "trust": {
      const { trustSystemPrompt, buildTrustPrompt } = await import("@/lib/documents/templates/michigan-revocable-trust");
      return { systemPrompt: trustSystemPrompt, buildPrompt: buildTrustPrompt };
    }
    case "pour_over_will": {
      const { pourOverWillSystemPrompt, buildPourOverWillPrompt } = await import("@/lib/documents/templates/michigan-pour-over-will");
      return { systemPrompt: pourOverWillSystemPrompt, buildPrompt: buildPourOverWillPrompt };
    }
    default:
      // No legacy generator exists for this type — the Certification of Trust,
      // the Assignments and the Funding Instructions were only ever written as
      // templates. Reaching here means the template path did not produce the
      // document either (PDF_RENDERER is off, or the intake failed the
      // template's checks in non-strict mode). Retrying cannot help, so this is
      // a hold: every caller already turns TemplateBlockedError into a `blocked`
      // document, a `blocked` order and ONE admin alert. As a plain Error the
      // order went `failed`, which the reconcile cron retries every 15 minutes —
      // re-running the Claude documents that had succeeded, each time, forever.
      throw new TemplateBlockedError(docType, [
        "a generator for this document type: it can only be produced from its template, and the template path did not produce it (PDF_RENDERER must be react-pdf or react-pdf-strict; if it is, see the server log for the template check that failed)",
      ]);
  }
}
