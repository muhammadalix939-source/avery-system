// Supplier payment settlement engine.
// A purchase is an OPEN ITEM until supplier payments allocated against it cover its amount.
// Payments may be allocated line-by-line (per service / per client) or auto-distributed
// oldest-first; any surplus stays as an "On Account" advance with the supplier.
import type { LedgerEntry, PaymentAllocation } from "./store";

export interface OpenItem {
  entry: LedgerEntry;
  label: string;
  serviceCategory: string;
  gross: number;
  settled: number;
  balance: number;
  /** Who the purchase was made for — used as the supplier-statement tag. */
  tag: string;
}

/** Total already allocated to one purchase entry across all supplier payments. */
export function settledAgainst(entries: LedgerEntry[], purchaseId: string): number {
  return entries
    .filter((e) => e.type === "supplier_payment")
    .flatMap((e) => e.allocations || [])
    .filter((a) => a.entryId === purchaseId)
    .reduce((s, a) => s + (a.amount || 0), 0);
}

/** Human tag shown in the supplier statement so an agent/client purchase is easy to spot. */
export function purchaseTag(e: LedgerEntry): string {
  if (e.purchasedFor === "agent" && (e.agentId || e.referenceName)) return `Agent: ${e.agentId || ""}`.trim();
  if (e.headId) return `Head: ${e.headId}`;
  return "Office";
}

/** Every unpaid / partly paid purchase of one supplier, oldest first. */
export function supplierOpenItems(entries: LedgerEntry[], supplierId: string): OpenItem[] {
  return entries
    .filter((e) => e.type === "purchase" && e.referenceId === supplierId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
    .map((entry) => {
      const settled = settledAgainst(entries, entry.id);
      return {
        entry,
        label: `${entry.serviceCategory || entry.chargeCategory || "Purchase"}${entry.note ? ` — ${entry.note}` : ""}`,
        serviceCategory: entry.serviceCategory || entry.chargeCategory || "Other",
        gross: entry.amount,
        settled,
        balance: Math.max(0, entry.amount - settled),
        tag: purchaseTag(entry),
      };
    });
}

/** Advance sitting with the supplier (paid more than the purchases booked so far). */
export function supplierOnAccount(entries: LedgerEntry[], supplierId: string): number {
  const paid = entries.filter((e) => e.type === "supplier_payment" && e.referenceId === supplierId).reduce((s, e) => s + e.amount, 0);
  const allocated = entries
    .filter((e) => e.type === "supplier_payment" && e.referenceId === supplierId)
    .flatMap((e) => e.allocations || [])
    .reduce((s, a) => s + (a.amount || 0), 0);
  return Math.max(0, paid - allocated);
}

/**
 * Build allocation lines for a payment.
 * - `selectedIds` empty  → auto-distribute oldest open item first.
 * - `selectedIds` chosen → clear those first, then spill the surplus onto the
 *   remaining open items (oldest first). Anything left over is an advance.
 */
export function distributeSupplierPayment(
  open: OpenItem[],
  amount: number,
  selectedIds: string[] = [],
): { allocations: PaymentAllocation[]; unallocated: number } {
  let left = Math.max(0, amount);
  const allocations: PaymentAllocation[] = [];
  const chosen = selectedIds.length
    ? [...open.filter((o) => selectedIds.includes(o.entry.id)), ...open.filter((o) => !selectedIds.includes(o.entry.id))]
    : open;

  for (const item of chosen) {
    if (left <= 0) break;
    if (item.balance <= 0) continue;
    const pay = Math.min(left, item.balance);
    left -= pay;
    allocations.push({
      entryId: item.entry.id,
      label: item.label,
      serviceCategory: item.serviceCategory,
      clientId: item.entry.clientId,
      headId: item.entry.headId || undefined,
      agentId: item.entry.agentId,
      amount: pay,
    });
  }
  return { allocations, unallocated: left };
}

/** Fully / partly / un-settled state of a purchase — drives the statement badge. */
export function settlementState(item: OpenItem): "Paid" | "Partial" | "Unpaid" {
  if (item.balance <= 0) return "Paid";
  return item.settled > 0 ? "Partial" : "Unpaid";
}
