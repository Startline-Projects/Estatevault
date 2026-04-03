import { NextResponse } from "next/server";
import { claude, CLAUDE_MODEL } from "@/lib/claude";

const WILL_FALLBACK = {
  headline: "A Will Package fits your situation.",
  bullets: [
    "Covers your estate based on your current situation",
    "Names your executor and protects your beneficiaries",
    "Includes Power of Attorney and Healthcare Directive",
  ],
};

const TRUST_FALLBACK = {
  headline: "A Trust Package fits your situation.",
  bullets: [
    "Helps your family avoid Michigan\u2019s probate process",
    "Protects your home and assets for your beneficiaries",
    "Includes all 4 documents your family needs",
  ],
};

export async function POST(request: Request) {
  try {
    const { quiz_answers, recommendation } = await request.json();

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
      return NextResponse.json(recommendation === "will" ? WILL_FALLBACK : TRUST_FALLBACK);
    }

    const systemPrompt = `You are a document preparation assistant for EstateVault, an estate planning document platform.
Your job is to generate a SHORT, WARM, PERSONALIZED explanation of why a specific document package fits a client's situation.

CRITICAL RULES — follow these exactly:
1. NEVER use the words "recommend", "advise", "suggest", or "you should"
2. ALWAYS frame findings as: "Based on your answers..." or "Your answers indicate..."
3. Generate exactly 3 bullet points
4. Each bullet must reference something specific from the client's answers
5. Keep each bullet under 20 words
6. Warm, simple language — no legal jargon
7. Do not mention attorney-client relationships
8. Do not guarantee any legal outcome

Return ONLY a JSON object in this exact format:
{
  "headline": "A [Will/Trust] Package fits your situation.",
  "bullets": [
    "bullet one text here",
    "bullet two text here",
    "bullet three text here"
  ]
}
Return nothing else. No markdown. No explanation. Just the raw JSON object.`;

    const a = quiz_answers;
    const userPrompt = `Client quiz answers:
- State: ${a.state || "Michigan"}
- Marital status: ${a.maritalStatus || a.marital_status || "Unknown"}
- Has children: ${a.hasChildren || a.has_children || "No"}
- Number of children: ${a.numberOfChildren || a.children_count || 0}
- Owns real estate: ${a.ownsRealEstate || a.owns_real_estate || "No"}
- Real estate only in Michigan: ${a.realEstateOnlyMichigan || a.real_estate_michigan_only || "N/A"}
- Owns a business: ${a.ownsBusiness || a.owns_business || "No"}
- Net worth range: ${a.netWorth || a.net_worth_range || "Unknown"}
- Privacy important (avoid probate): ${a.privacyImportant || a.privacy_important || "No"}
- Charitable giving plans: ${a.charitableGiving || a.charitable_intent || "No"}
- Has existing estate plan: ${a.hasExistingPlan || a.has_existing_plan || "No"}
- Additional complexity noted: ${a.additionalSituation || a.other_complexity || "None"}

Recommended package: ${recommendation}

Generate the personalized summary.`;

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content.length > 0 && response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = JSON.parse(text);
      if (parsed.headline && Array.isArray(parsed.bullets) && parsed.bullets.length === 3) {
        return NextResponse.json(parsed);
      }
    } catch {
      // Claude returned non-JSON — fall through to fallback
    }

    return NextResponse.json(recommendation === "will" ? WILL_FALLBACK : TRUST_FALLBACK);
  } catch (error) {
    console.error("Quiz personalization error:", error);
    // Don't try to read request body again — it was already consumed above
    return NextResponse.json(WILL_FALLBACK);
  }
}
