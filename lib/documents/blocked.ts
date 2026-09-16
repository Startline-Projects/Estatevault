/*
 * Blocked document generation.
 *
 * In strict mode the template pipeline refuses to produce a document it cannot
 * render correctly (see TemplateBlockedError). Rather than silently falling
 * back to the legacy generator or shipping a document with blank clauses, the
 * document is marked 'blocked' with the reason recorded, the order is held back
 * from fulfillment, and an administrator is alerted once per order.
 */

import * as documentRepo from "@/lib/repos/server/documentRepo";
import { createAdminClient } from "@/lib/api/auth";
import { sendEmail } from "@/lib/email";
import { checkPourOverStaleness, type BeneficiaryLike } from "./staleness";

type Admin = ReturnType<typeof createAdminClient>;

export const BLOCKED_STATUS = "blocked";

export interface BlockedDocument {
  docType: string;
  reasons: string[];
}

/** Marks one document blocked and records why. */
export async function markDocumentBlocked(
  admin: Admin,
  orderId: string,
  docType: string,
  reasons: string[],
) {
  const reason = reasons.join("; ");
  console.error(`[BLOCKED] order ${orderId} ${docType}: ${reason}`);
  return documentRepo.updateStatusByType(admin, orderId, docType, BLOCKED_STATUS, {
    generation_error: reason.slice(0, 2000),
  });
}

/**
 * How many documents on this order are blocked.
 * Fulfillment is gated on this being zero.
 */
export async function countBlockedForOrder(admin: Admin, orderId: string): Promise<number> {
  const { count, error } = await documentRepo.countByStatus(admin, orderId, BLOCKED_STATUS);
  if (error) {
    // Fail closed: if the gate cannot be evaluated, treat the order as held.
    console.error(`[BLOCKED] could not count blocked documents for order ${orderId}:`, error);
    return 1;
  }
  return count ?? 0;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Sends ONE alert for an order, however many of its documents are blocked.
 * Never throws: an alert failure must not take down document generation.
 */
export async function alertAdminOrderBlocked(params: {
  orderId: string;
  clientName?: string;
  blocked: BlockedDocument[];
  origin?: string;
}): Promise<void> {
  const to = process.env.SALES_NOTIFICATION_EMAIL;
  if (!to) {
    console.error(`[BLOCKED] SALES_NOTIFICATION_EMAIL is not set; no alert sent for order ${params.orderId}`);
    return;
  }
  if (params.blocked.length === 0) return;

  const rows = params.blocked
    .map(
      (b) =>
        `<tr><td style="padding:6px 12px;border:1px solid #ddd;"><strong>${escapeHtml(b.docType)}</strong></td>` +
        `<td style="padding:6px 12px;border:1px solid #ddd;">${escapeHtml(b.reasons.join("; "))}</td></tr>`,
    )
    .join("");

  try {
    await sendEmail({
      from: "EstateVault <noreply@estatevault.us>",
      to,
      subject: `Order held: ${params.blocked.length} document(s) could not be generated (${params.orderId})`,
      html: `
        <p>Document generation was blocked for an order. The order has <strong>not</strong> been delivered.</p>
        <p><strong>Order:</strong> ${escapeHtml(params.orderId)}${
          params.clientName ? `<br><strong>Client:</strong> ${escapeHtml(params.clientName)}` : ""
        }</p>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
          <tr><th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Document</th>
              <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Missing</th></tr>
          ${rows}
        </table>
        <p>The intake needs completing before these documents can be generated. Once it is complete,
           re-run generation for this order.</p>
      `,
    });
  } catch (e) {
    console.error(`[BLOCKED] alert email failed for order ${params.orderId}:`, e);
  }
}


// ── Staleness ────────────────────────────────────────────────────────────────

/** Document types whose content embeds another document's data. */
const INTAKE_COUPLED_TYPES = new Set(["pour_over_will"]);

export interface StaleDocument extends BlockedDocument {
  /** True when the current intake is still available, so it can be rebuilt. */
  regenerable: boolean;
}

/**
 * Finds documents on this order that no longer match the current intake.
 *
 * Only documents that recorded a fingerprint are checked. A null fingerprint
 * means a legacy or Claude-generated document with no intake coupling — those
 * are left alone rather than blocked, which would otherwise hold every order
 * generated before fingerprinting existed.
 */
export async function findStaleDocuments(
  admin: Admin,
  orderId: string,
  currentBeneficiaries: readonly BeneficiaryLike[],
): Promise<StaleDocument[]> {
  const { data, error } = await admin
    .from("documents")
    .select("document_type, source_fingerprint, status")
    .eq("order_id", orderId);

  if (error) {
    console.error(`[STALE] could not read documents for order ${orderId}:`, error);
    return [];
  }

  const stale: StaleDocument[] = [];
  for (const row of data ?? []) {
    if (!INTAKE_COUPLED_TYPES.has(row.document_type)) continue;
    if (!row.source_fingerprint) continue; // not fingerprinted: not our business
    const verdict = checkPourOverStaleness(row.source_fingerprint, currentBeneficiaries);
    if (verdict.stale) {
      stale.push({
        docType: row.document_type,
        reasons: [verdict.reason],
        regenerable: currentBeneficiaries.length > 0,
      });
    }
  }
  return stale;
}

/**
 * The fulfillment gate, in one place.
 *
 * It was duplicated across four routes with three subtly different behaviours,
 * which is how a document could end up marked delivered on an order that was
 * itself blocked. Returns true when the order is held.
 */
export async function isOrderHeld(
  admin: Admin,
  orderId: string,
  blocked: BlockedDocument[],
  clientName?: string,
): Promise<boolean> {
  const count = blocked.length || (await countBlockedForOrder(admin, orderId));
  if (count === 0) return false;

  await admin.from("orders").update({ status: "blocked" }).eq("id", orderId);
  // countBlockedForOrder can find a document blocked by an earlier run that is
  // not in this run's array; alerting on an empty array would send nothing, so
  // describe it rather than stay silent.
  const toAlert: BlockedDocument[] = blocked.length
    ? blocked
    : [{ docType: "(recorded earlier)", reasons: ["a document on this order is blocked from a previous run"] }];
  await alertAdminOrderBlocked({ orderId, clientName, blocked: toAlert });
  return true;
}

/**
 * Rebuilds a stale document in place and records the supersede chain.
 *
 * Regenerating is preferable to blocking whenever the current intake is still
 * available: the template pipeline is deterministic and needs no model call, so
 * the client gets a correct document instead of a held order. Blocking is the
 * fallback for when the intake is gone and the document cannot be rebuilt.
 *
 * Returns the documents that could NOT be regenerated and must block instead.
 */
export async function regenerateStaleDocuments(
  admin: Admin,
  params: {
    orderId: string;
    clientId: string;
    intake: Record<string, unknown>;
    stale: StaleDocument[];
    partnerName?: string;
    partnerLogoUrl?: string | null;
    clientFullName: string;
  },
): Promise<BlockedDocument[]> {
  const unrecoverable: BlockedDocument[] = [];

  for (const doc of params.stale) {
    if (!doc.regenerable) {
      unrecoverable.push({ docType: doc.docType, reasons: doc.reasons });
      continue;
    }
    try {
      const { tryTemplateRender } = await import("./generate-from-template");
      const rebuilt = await tryTemplateRender(
        doc.docType,
        params.intake,
        params.partnerName,
        params.partnerLogoUrl,
        params.clientFullName,
      );
      if (!rebuilt) {
        unrecoverable.push({
          docType: doc.docType,
          reasons: [...doc.reasons, "and it could not be rebuilt from the current intake"],
        });
        continue;
      }

      // Record that the previous version was replaced before overwriting it, so
      // the chain is not lost. These columns existed unused until now.
      const { data: previous } = await admin
        .from("documents")
        .select("id, version")
        .eq("order_id", params.orderId)
        .eq("document_type", doc.docType)
        .maybeSingle();

      const { uploadDocument } = await import("./storage");
      await uploadDocument(
        params.clientId,
        params.orderId,
        doc.docType,
        rebuilt.pdfBuffer,
        undefined,
        { templateVersion: rebuilt.templateVersion, sourceFingerprint: rebuilt.sourceFingerprint },
      );

      if (previous?.id) {
        await admin
          .from("documents")
          .update({
            superseded_at: new Date().toISOString(),
            version: (previous.version ?? 1) + 1,
            generation_error: null,
          })
          .eq("id", previous.id);
      }
      console.warn(`[STALE] order ${params.orderId} ${doc.docType}: regenerated from current intake`);
    } catch (e) {
      unrecoverable.push({
        docType: doc.docType,
        reasons: [...doc.reasons, `and regeneration failed: ${e instanceof Error ? e.message : String(e)}`],
      });
    }
  }

  return unrecoverable;
}
