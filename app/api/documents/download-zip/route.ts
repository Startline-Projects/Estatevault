import { NextResponse, type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import { generateFundingInstructionsPDF } from "@/lib/documents/generate-funding-instructions";

// CRC32 lookup table
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crc32Table[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const DOC_LABELS: Record<string, string> = {
  will: "Last Will and Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

export const GET = withRoute(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  const firstName = searchParams.get("first_name") || "Test";
  const lastName = searchParams.get("last_name") || "User";

  if (!orderId) return fail("Missing order_id", 400);

  const supabase = createAdminClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("document_type, storage_path, status")
    .eq("order_id", orderId)
    .in("status", ["generated", "delivered"])
    .not("storage_path", "is", null);

  if (!documents || documents.length === 0) {
    return fail("Documents not ready", 400);
  }

  const files: Array<{ name: string; data: Uint8Array }> = [];

  for (const doc of documents) {
    if (!doc.storage_path) continue;
    const { data, error } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (error || !data) continue;

    const label = DOC_LABELS[doc.document_type] || doc.document_type;
    const arrayBuffer = await data.arrayBuffer();
    files.push({ name: `${label}.pdf`, data: new Uint8Array(arrayBuffer) });
  }

  if (files.length === 0) return fail("No files available", 400);

  const { data: order } = await supabase
    .from("orders")
    .select("product_type, intake_data")
    .eq("id", orderId)
    .single();

  if (order?.product_type === "trust") {
    const intake = (order.intake_data || {}) as Record<string, unknown>;
    const assetTypes = (intake.assetTypes as string[]) || [];
    const fundingPdf = await generateFundingInstructionsPDF(firstName, lastName, assetTypes);
    files.push({ name: "Trust Funding Instructions.pdf", data: fundingPdf });
  }

  // Build ZIP file manually (minimal ZIP format)
  const zipParts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const nameLen = nameBytes.length;
    const fileData = file.data;
    const fileLen = fileData.length;
    const fileCrc = crc32(fileData);

    const localHeader = new Uint8Array(30 + nameLen);
    const lhView = new DataView(localHeader.buffer);
    lhView.setUint32(0, 0x04034b50, true);
    lhView.setUint16(4, 20, true);
    lhView.setUint16(6, 0, true);
    lhView.setUint16(8, 0, true);
    lhView.setUint16(10, 0, true);
    lhView.setUint16(12, 0, true);
    lhView.setUint32(14, fileCrc, true);
    lhView.setUint32(18, fileLen, true);
    lhView.setUint32(22, fileLen, true);
    lhView.setUint16(26, nameLen, true);
    lhView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    zipParts.push(localHeader);
    zipParts.push(fileData);

    const cdEntry = new Uint8Array(46 + nameLen);
    const cdView = new DataView(cdEntry.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, fileCrc, true);
    cdView.setUint32(20, fileLen, true);
    cdView.setUint32(24, fileLen, true);
    cdView.setUint16(28, nameLen, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, offset, true);
    cdEntry.set(nameBytes, 46);

    centralDir.push(cdEntry);
    offset += 30 + nameLen + fileLen;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) cdSize += cd.length;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);

  const totalSize = offset + cdSize + 22;
  const zipBuffer = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of zipParts) { zipBuffer.set(part, pos); pos += part.length; }
  for (const cd of centralDir) { zipBuffer.set(cd, pos); pos += cd.length; }
  zipBuffer.set(eocd, pos);

  const zipName = `Test - ${firstName} ${lastName}.zip`;

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Content-Length": totalSize.toString(),
    },
  });
});
