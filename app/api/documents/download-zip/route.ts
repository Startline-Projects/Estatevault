import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

const DOC_LABELS: Record<string, string> = {
  will: "Last Will and Testament",
  trust: "Revocable Living Trust",
  pour_over_will: "Pour-Over Will",
  poa: "Durable Power of Attorney",
  healthcare_directive: "Healthcare Directive",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");
    const firstName = searchParams.get("first_name") || "Test";
    const lastName = searchParams.get("last_name") || "User";

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get documents for this order — only those that are generated
    const { data: documents } = await supabase
      .from("documents")
      .select("document_type, storage_path, status")
      .eq("order_id", orderId)
      .in("status", ["generated", "delivered"])
      .not("storage_path", "is", null);

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: "Documents not ready" }, { status: 400 });
    }

    // Download each PDF from storage
    const files: Array<{ name: string; data: Uint8Array }> = [];

    for (const doc of documents) {
      if (!doc.storage_path) continue;
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.storage_path);

      if (error || !data) continue;

      const label = DOC_LABELS[doc.document_type] || doc.document_type;
      const arrayBuffer = await data.arrayBuffer();
      files.push({
        name: `${label}.pdf`,
        data: new Uint8Array(arrayBuffer),
      });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files available" }, { status: 400 });
    }

    // Build ZIP file manually (minimal ZIP format — no external library)
    const zipParts: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = new TextEncoder().encode(file.name);
      const nameLen = nameBytes.length;
      const fileData = file.data;
      const fileLen = fileData.length;

      // Local file header (30 bytes + name + data)
      const localHeader = new Uint8Array(30 + nameLen);
      const lhView = new DataView(localHeader.buffer);
      lhView.setUint32(0, 0x04034b50, true); // signature
      lhView.setUint16(4, 20, true); // version needed
      lhView.setUint16(6, 0, true); // flags
      lhView.setUint16(8, 0, true); // compression (stored)
      lhView.setUint16(10, 0, true); // mod time
      lhView.setUint16(12, 0, true); // mod date
      lhView.setUint32(14, 0, true); // crc32 (0 for simplicity)
      lhView.setUint32(18, fileLen, true); // compressed size
      lhView.setUint32(22, fileLen, true); // uncompressed size
      lhView.setUint16(26, nameLen, true); // name length
      lhView.setUint16(28, 0, true); // extra length
      localHeader.set(nameBytes, 30);

      zipParts.push(localHeader);
      zipParts.push(fileData);

      // Central directory entry (46 bytes + name)
      const cdEntry = new Uint8Array(46 + nameLen);
      const cdView = new DataView(cdEntry.buffer);
      cdView.setUint32(0, 0x02014b50, true); // signature
      cdView.setUint16(4, 20, true); // version made by
      cdView.setUint16(6, 20, true); // version needed
      cdView.setUint16(8, 0, true); // flags
      cdView.setUint16(10, 0, true); // compression
      cdView.setUint16(12, 0, true); // mod time
      cdView.setUint16(14, 0, true); // mod date
      cdView.setUint32(16, 0, true); // crc32
      cdView.setUint32(20, fileLen, true); // compressed size
      cdView.setUint32(24, fileLen, true); // uncompressed size
      cdView.setUint16(28, nameLen, true); // name length
      cdView.setUint16(30, 0, true); // extra length
      cdView.setUint16(32, 0, true); // comment length
      cdView.setUint16(34, 0, true); // disk number
      cdView.setUint16(36, 0, true); // internal attrs
      cdView.setUint32(38, 0, true); // external attrs
      cdView.setUint32(42, offset, true); // local header offset
      cdEntry.set(nameBytes, 46);

      centralDir.push(cdEntry);
      offset += 30 + nameLen + fileLen;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const cd of centralDir) cdSize += cd.length;

    // End of central directory (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // signature
    eocdView.setUint16(4, 0, true); // disk number
    eocdView.setUint16(6, 0, true); // cd disk
    eocdView.setUint16(8, files.length, true); // entries on disk
    eocdView.setUint16(10, files.length, true); // total entries
    eocdView.setUint32(12, cdSize, true); // cd size
    eocdView.setUint32(16, cdOffset, true); // cd offset
    eocdView.setUint16(20, 0, true); // comment length

    // Concatenate all parts
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
  } catch (error) {
    console.error("ZIP download error:", error);
    return NextResponse.json({ error: "Failed to create ZIP" }, { status: 500 });
  }
}
