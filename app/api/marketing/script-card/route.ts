import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: partner } = await admin.from("partners").select("company_name, product_name, accent_color").eq("profile_id", user.id).single();

  const companyName = partner?.company_name || "Your Company";
  const productName = partner?.product_name || "Legacy Protection";

  // Build PDF with pdf-lib
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = PageSizes.Letter;
  const margin = 60;
  const contentWidth = pageWidth - 2 * margin;

  const page = pdfDoc.addPage(PageSizes.Letter);
  let y = pageHeight - margin;
  const navy = rgb(0.11, 0.21, 0.34);
  const gold = rgb(0.79, 0.66, 0.30);
  const red = rgb(0.86, 0.15, 0.15);
  const gray = rgb(0.4, 0.4, 0.4);
  const black = rgb(0, 0, 0);

  function drawText(text: string, opts: { font?: typeof helvetica; size?: number; color?: typeof black; x?: number }) {
    const font = opts.font || helvetica;
    const size = opts.size || 10;
    page.drawText(text, { x: opts.x || margin, y, size, font, color: opts.color || black });
    y -= size * 1.5;
  }

  function drawWrapped(text: string, opts: { font?: typeof helvetica; size?: number; color?: typeof black; indent?: number }) {
    const font = opts.font || helvetica;
    const size = opts.size || 10;
    const indent = opts.indent || 0;
    const maxWidth = contentWidth - indent;
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        page.drawText(line, { x: margin + indent, y, size, font, color: opts.color || black });
        y -= size * 1.5;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: margin + indent, y, size, font, color: opts.color || black });
      y -= size * 1.5;
    }
  }

  // Header
  drawText(companyName, { font: helveticaBold, size: 14, color: navy });
  y -= 2;
  page.drawRectangle({ x: margin, y: y + 4, width: 140, height: 16, color: gold, borderWidth: 0 });
  page.drawText("COMPLIANCE SCRIPT CARD", { x: margin + 8, y: y + 7, size: 8, font: helveticaBold, color: rgb(1, 1, 1) });
  y -= 22;
  drawText("Approved Scripts for Estate Planning Conversations", { font: helveticaBold, size: 13, color: navy });
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: margin + contentWidth, y: y + 8 }, thickness: 1.5, color: gold });
  y -= 10;

  // Script 1
  drawText("Introduction Script (use word-for-word)", { font: helveticaBold, size: 11, color: navy });
  y -= 4;
  page.drawRectangle({ x: margin, y: y - 52, width: contentWidth, height: 62, color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
  y -= 4;
  drawWrapped(`"[Client name], one thing I want to make sure we cover today is your estate plan. A lot of my clients have been using a platform called ${productName} to get their wills and trusts done quickly and affordably. It generates attorney-reviewed documents, takes about 15 minutes. Would you like me to walk you through it?"`, { size: 9, indent: 8 });
  y -= 8;

  // Script 2
  drawText('If they ask "Are you my lawyer?"', { font: helveticaBold, size: 11, color: navy });
  y -= 4;
  page.drawRectangle({ x: margin, y: y - 42, width: contentWidth, height: 52, color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
  y -= 4;
  drawWrapped(`"No, I'm not acting as your attorney, and this platform doesn't provide legal advice. What it does is generate attorney-reviewed estate planning documents based on your answers. If you have complex legal questions, we can connect you with a licensed estate planning attorney."`, { size: 9, indent: 8 });
  y -= 8;

  // Script 3
  drawText('If they ask "Is this legitimate?"', { font: helveticaBold, size: 11, color: navy });
  y -= 4;
  page.drawRectangle({ x: margin, y: y - 30, width: contentWidth, height: 40, color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
  y -= 4;
  drawWrapped(`"Yes, all documents are based on attorney-approved templates specific to Michigan. They're the same documents an estate planning attorney would prepare, at a fraction of the cost."`, { size: 9, indent: 8 });
  y -= 12;

  // Never say section
  drawText("NEVER SAY:", { font: helveticaBold, size: 12, color: red });
  y -= 2;
  const neverItems = [
    '"I recommend you get a trust"',
    '"You should do this"',
    '"As your advisor I think you need..."',
    '"This is legal advice"',
    '"I\'m helping you with your legal plan"',
  ];
  for (const item of neverItems) {
    drawText(`  \u2717  ${item}`, { size: 10, color: red });
  }

  // Footer
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 14;
  drawText(`${companyName} | Powered by EstateVault`, { size: 8, color: gray });
  drawText("This platform provides document preparation services only. It does not provide legal advice.", { size: 8, color: gray });

  const pdfBytes = await pdfDoc.save();

  // Log download
  await admin.from("audit_log").insert({ actor_id: user.id, action: "marketing.download", metadata: { asset_type: "script_card" } });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${companyName} - Compliance Script Card.pdf"`,
    },
  });
}
