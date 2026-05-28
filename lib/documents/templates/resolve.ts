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
      throw new Error(`Unknown document type: ${docType}`);
  }
}
