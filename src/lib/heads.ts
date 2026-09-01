// Head / Group business economics — single source of truth for the Head Business View card.
import type { Booking, Client } from "./data";
import type { LedgerEntry } from "./store";

export interface HeadBusiness {
  headId: string;
  leadName: string;
  members: number;
  perPerson: number;
  otherCosts: number;
  totalSale: number;
  refunds: number;
  netReceivable: number;
  totalPurchase: number;
  commission: number;
  netProfit: number;
  received: number;
  outstanding: number;
  linked: LedgerEntry[];
}

/** Flat, disclosed amounts only — no interest, no compounding. */
export function computeHeadBusiness(
  headId: string,
  clients: Client[],
  bookings: Booking[],
  entries: LedgerEntry[],
): HeadBusiness {
  const members = clients.filter((c) => c.headId === headId);
  const booking = bookings.find((b) => b.headId === headId);
  const linked = entries.filter((e) => e.headId === headId);

  const otherCosts = linked.filter((e) => e.type === "client_charge").reduce((s, e) => s + e.amount, 0);
  const base = booking?.baseAmount ?? booking?.totalAmount ?? members.reduce((s, c) => s + (c.baseDue ?? c.amountDue), 0);
  const perPerson = members.length ? Math.round(base / members.length) : base;
  const totalSale = perPerson * (members.length || 1) + otherCosts;
  const refunds = linked.filter((e) => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const netReceivable = totalSale - refunds;
  const purchaseEntries = linked.filter((e) => e.type === "purchase");
  const supplierRefunds = linked.filter((e) => e.type === "supplier_refund").reduce((s, e) => s + e.amount, 0);
  const totalPurchase = Math.max(purchaseEntries.reduce((s, e) => s + e.amount, 0), booking?.totalCost || 0) - supplierRefunds;
  const commission = booking?.commission || 0;
  const received = linked.filter((e) => e.type === "client_receive").reduce((s, e) => s + e.amount, 0);

  const lead = members[0];
  return {
    headId,
    leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() : headId,
    members: members.length,
    perPerson,
    otherCosts,
    totalSale,
    refunds,
    netReceivable,
    totalPurchase,
    commission,
    netProfit: netReceivable - totalPurchase - commission,
    received,
    outstanding: Math.max(0, netReceivable - received),
    linked,
  };
}
