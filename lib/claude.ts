import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-5";

let _claude: Anthropic | null = null;
function initClaude(): Anthropic {
  if (!_claude) {
    _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _claude;
}

// Test mode: skip the Anthropic API entirely and return placeholder document
// text. Lets you exercise the full fulfillment flow (generation → statuses →
// attorney-review lock/unlock → admin retry → downloads) WITHOUT spending any
// Anthropic credits. Enable by setting MOCK_DOC_GENERATION=true in .env.local.
// Never enable in production.
const MOCK_DOC_GENERATION = process.env.MOCK_DOC_GENERATION === "true";

type MessageCreateParams = {
  system?: string;
  messages?: Array<{ role: string; content: unknown }>;
};

function mockMessage(params: MessageCreateParams) {
  const userContent = params.messages?.[0]?.content;
  const promptSnippet =
    typeof userContent === "string"
      ? userContent.slice(0, 400)
      : JSON.stringify(userContent).slice(0, 400);
  const text = [
    "=== MOCK DOCUMENT — TEST MODE ===",
    "",
    "This is placeholder text generated WITHOUT the Anthropic API",
    "(MOCK_DOC_GENERATION=true). No credits were spent.",
    "",
    "It exists only to exercise the fulfillment pipeline: PDF rendering,",
    "storage upload, order/document status transitions, the attorney-review",
    "lock, admin retry, and client downloads.",
    "",
    "--- intake/prompt preview ---",
    promptSnippet,
    "",
    "=== END MOCK DOCUMENT ===",
  ].join("\n");

  return {
    id: "msg_mock",
    type: "message",
    role: "assistant",
    model: CLAUDE_MODEL,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    content: [{ type: "text", text }],
  };
}

export const claude = new Proxy({} as Anthropic, {
  get(_, prop) {
    // Intercept claude.messages.create in mock mode so every call site (process,
    // process-now, regenerate-missing) generates placeholder docs for free.
    if (MOCK_DOC_GENERATION && prop === "messages") {
      return { create: async (params: MessageCreateParams) => mockMessage(params) };
    }
    return Reflect.get(initClaude(), prop);
  },
});
