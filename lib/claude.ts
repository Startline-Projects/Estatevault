import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "placeholder",
});

export const CLAUDE_MODEL = "claude-sonnet-4-5";
