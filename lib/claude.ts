import Anthropic from "@anthropic-ai/sdk";

let _claude: Anthropic | null = null;
function initClaude(): Anthropic {
  if (!_claude) {
    _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _claude;
}

export const claude = new Proxy({} as Anthropic, {
  get(_, prop) {
    return Reflect.get(initClaude(), prop);
  },
});

export const CLAUDE_MODEL = "claude-sonnet-4-5";
