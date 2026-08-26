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
