import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ASSET_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  "Primary home / real estate in Michigan": {
    title: "Real Estate in Michigan",
    steps: [
      "Prepare a Michigan Quit Claim Deed transferring ownership from your name to your trust.",
      "The deed should transfer from \"[Your Name]\" to \"[Your Name], Trustee of the [Your Name] Revocable Living Trust, dated [date].\"",
      "Record the deed with your county Register of Deeds office.",
    ],
  },
  "Real estate in another state": {
    title: "Real Estate in Another State",
    steps: [
      "Each state has its own deed requirements for transferring property into a trust.",
      "Contact a title company or attorney in each state where you own property.",
      "Transfer each property by deed into your trust to avoid ancillary probate in that state.",
    ],
  },
  "Bank and investment accounts": {
    title: "Bank and Investment Accounts",
    steps: [
      "Contact each bank or financial institution to retitle your accounts in the name of your trust.",
      "Provide a copy of your Trust Certificate (included with your trust documents).",
      "New title format: \"[Your Name], Trustee of the [Your Name] Revocable Living Trust.\"",
      "For retirement accounts (401k, IRA): do NOT retitle these, instead update the beneficiary designation to your trust.",
    ],
  },
  "Business interests": {
    title: "Business Interests",
    steps: [
      "For LLCs: Amend your Operating Agreement to reflect the trust as a member and assign your membership interest.",
      "For corporations: Transfer your stock certificates to the trust.",
      "For sole proprietorships: Execute an Assignment of Business Interest to your trust.",
      "Consult with your business attorney to ensure proper transfer and maintain liability protection.",
    ],
  },
  "Vehicles": {
    title: "Vehicles",
    steps: [
      "Vehicles valued under $60,000 do not need to be titled into your trust. They are covered as personal property under your Assignment of Personal Property document.",
      "Vehicles valued over $60,000 should be titled into your trust. Visit your local Michigan Secretary of State office.",
      "For vehicles over $60,000: Bring your current title, trust certificate, and valid ID.",
      "Request a title transfer to: \"[Your Name], Trustee of the [Your Name] Revocable Living Trust.\"",
      "Update your auto insurance policy to reflect the trust as the named insured.",
    ],
  },
  "Personal property and valuables": {
    title: "Personal Property and Valuables",
    steps: [
      "Your trust package includes a general Assignment of Personal Property.",
      "Sign this document to transfer ownership of furniture, jewelry, artwork, and other personal items to your trust.",
      "Keep the signed assignment with your trust documents.",
    ],
  },
  "Digital assets and cryptocurrency": {
    title: "Digital Assets and Cryptocurrency",
    steps: [
      "For cryptocurrency: Transfer holdings to a wallet owned by the trust, or name the trust as beneficiary on your exchange account.",
      "For digital accounts (email, social media): Store access credentials in your EstateVault digital vault.",
      "Set up memorial/legacy contacts where available (Google, Facebook, Apple).",
      "Include digital asset instructions in your Letter of Intent (optional but recommended).",
    ],
  },
};

export async function generateFundingInstructionsPDF(
  firstName: string,
  lastName: string,
  assetTypes: string[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(28 / 255, 53 / 255, 87 / 255);
  const charcoal = rgb(45 / 255, 45 / 255, 45 / 255);
  const gold = rgb(201 / 255, 168 / 255, 76 / 255);

  const pageWidth = 612; // letter
  const pageHeight = 792;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function addPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  function checkSpace(needed: number) {
    if (y - needed < margin) addPage();
  }

  // Title
  page.drawText("Trust Funding Instructions", { x: margin, y, size: 22, font: fontBold, color: navy });
  y -= 30;

  page.drawText(`Prepared for: ${firstName} ${lastName}`, { x: margin, y, size: 12, font, color: charcoal });
  y -= 18;
  page.drawText(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { x: margin, y, size: 10, font, color: charcoal });
  y -= 30;

  // Gold divider line
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 2, color: gold });
  y -= 25;

  // Intro
  const introLines = [
    "Your Revocable Living Trust is only effective if your assets are properly titled in the name",
    "of your trust. This process is called \"funding\" your trust. Below are step-by-step instructions",
    "for each type of asset you indicated during your intake.",
  ];
  for (const line of introLines) {
    checkSpace(16);
    page.drawText(line, { x: margin, y, size: 10, font, color: charcoal });
    y -= 16;
  }
  y -= 10;

  checkSpace(20);
  page.drawText("IMPORTANT: Assets not transferred to your trust may be subject to probate.", {
    x: margin, y, size: 10, font: fontBold, color: navy,
  });
  y -= 30;

  const fullName = `${firstName} ${lastName}`;

  // Asset sections
  const relevantAssets = assetTypes.length > 0
    ? assetTypes.filter((a) => ASSET_INSTRUCTIONS[a])
    : Object.keys(ASSET_INSTRUCTIONS);

  for (const assetKey of relevantAssets) {
    const rawAsset = ASSET_INSTRUCTIONS[assetKey];
    if (!rawAsset) continue;
    const asset = {
      ...rawAsset,
      steps: rawAsset.steps.map((s) => s.replaceAll("[Your Name]", fullName)),
    };

    checkSpace(60);

    // Section header
    page.drawRectangle({ x: margin, y: y - 2, width: contentWidth, height: 20, color: rgb(0.95, 0.95, 0.95) });
    page.drawText(asset.title, { x: margin + 8, y: y + 2, size: 12, font: fontBold, color: navy });
    y -= 28;

    // Steps
    for (let i = 0; i < asset.steps.length; i++) {
      const step = asset.steps[i];
      const stepNum = `${i + 1}. `;
      const maxCharsPerLine = 85;

      // Word wrap
      const words = step.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).length > maxCharsPerLine && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + " " + word : word;
        }
      }
      if (currentLine) lines.push(currentLine);

      for (let j = 0; j < lines.length; j++) {
        checkSpace(16);
        const prefix = j === 0 ? stepNum : "   ";
        page.drawText(prefix + lines[j], { x: margin + 10, y, size: 10, font, color: charcoal });
        y -= 16;
      }
    }

    y -= 12;
  }

  // Footer section
  checkSpace(80);
  y -= 10;
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 2, color: gold });
  y -= 25;

  page.drawText("Questions?", { x: margin, y, size: 12, font: fontBold, color: navy });
  y -= 18;
  page.drawText("Log in to your EstateVault account to access your documents, digital vault, and funding checklist.", {
    x: margin, y, size: 10, font, color: charcoal,
  });
  y -= 16;
  page.drawText("Visit: www.estatevault.us/dashboard", { x: margin, y, size: 10, font, color: gold });

  return pdf.save();
}
