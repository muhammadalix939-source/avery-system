import type { Booking, Client } from "./data";
import type { LedgerEntry } from "./store";
import { headCostOf, headSupplierPaid, purchaseAllocations, paymentAllocations } from "./allocations";

export interface HeadBusinessMember {
  id: string;
  name: string;
  ageCategory?: string;
  amount: number;
  received: number;
  pending: number;
  status: "Paid" | "Partial" | "Unpaid";
}

export interface AllocatedPurchaseView {
  entryId: string;
  date: string;
  supplier: string;
  service: string;
  share: number;
  ofTotal: number;
}

export interface HeadBusiness {
  headId: string;
  leadName: string;
  members: number;
  perPerson: number;
  otherCosts: number;
  grossSale: number;
  discount: number;
  totalSale: number;
  refunds: number;
  netReceivable: number;
  totalPurchase: number;
  commission: number;
  netProfit: number;
  received: number;
  outstanding: number;
  supplierPaid: number;
  supplierRemaining: number;
  memberList: HeadBusinessMember[];
  linked: LedgerEntry[];
  allocatedPurchases: AllocatedPurchaseView[];
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

  // Linked entries for the ledger tab: includes direct headId plus any entry where headId is allocated
  const linked = entries.filter((e) => {
    if (e.headId === headId) return true;
    if (e.type === "purchase") {
      return purchaseAllocations(e).some((l) => l.target === "head" && l.headId === headId);
    }
    if (e.type === "supplier_payment") {
      return paymentAllocations(e).some((l) => l.target === "head" && l.headId === headId);
    }
    return false;
  });

  const otherCosts = linked.filter((e) => e.type === "client_charge").reduce((s, e) => s + e.amount, 0);
  const discountEntries = linked.filter((e) => e.type === "client_discount").reduce((s, e) => s + e.amount, 0);
  const bookingDiscount = Number(booking?.discount) || 0;
  const totalDiscount = bookingDiscount + discountEntries;

  const grossBase = booking?.baseAmount ?? (booking ? booking.totalAmount + bookingDiscount : members.reduce((s, c) => s + (c.baseDue ?? c.amountDue), 0));
  const perPerson = members.length ? Math.round(grossBase / members.length) : grossBase;
  const grossSale = perPerson * (members.length || 1) + otherCosts;
  const totalSale = Math.max(0, grossSale - totalDiscount);
  const refunds = linked.filter((e) => e.type === "client_refund").reduce((s, e) => s + e.amount, 0);
  const netReceivable = Math.max(0, totalSale - refunds);

  // Supplier refunds specifically tagged to this head
  const supplierRefunds = linked.filter((e) => e.type === "supplier_refund" && e.headId === headId).reduce((s, e) => s + e.amount, 0);
  const allocatedCost = headCostOf(entries, headId);
  const totalPurchase = Math.max(allocatedCost, booking?.totalCost || 0) - supplierRefunds;
  
  const originalCommission = booking?.commission || 0;
  let commission = originalCommission;
  if (booking && booking.agentId && booking.agentId !== "Direct" && booking.discountSettlement === "agent_commission") {
    const agentAbsorbed = Math.min(originalCommission, bookingDiscount);
    commission = Math.max(0, originalCommission - agentAbsorbed);
  }
  const received = linked.filter((e) => e.type === "client_receive").reduce((s, e) => s + e.amount, 0);

  // Supplier paid via allocations engine (direct lines + prorated group payments)
  const supplierPaid = headSupplierPaid(entries, headId);
  const supplierRemaining = Math.max(0, Math.round(totalPurchase - supplierPaid));

  // Allocated purchases breakdown for UI Card
  const allocatedPurchases: AllocatedPurchaseView[] = [];
  entries.forEach((e) => {
    if (e.type !== "purchase") return;
    const lines = purchaseAllocations(e);
    lines.forEach((l) => {
      if (l.target === "head" && l.headId === headId) {
        allocatedPurchases.push({
          entryId: e.id,
          date: e.date,
          supplier: e.referenceName || e.referenceId || "Supplier",
          service: e.serviceCategory || "Purchase",
          share: l.amount,
          ofTotal: e.amount,
        });
      }
    });
  });

  // ---- Per-member (Members View) breakdown ----
  const memberList: HeadBusinessMember[] = members.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    ageCategory: c.ageCategory,
    amount: c.amountDue,
    received: c.amountPaid,
    pending: Math.max(0, c.amountDue - c.amountPaid),
    status: c.paymentStatus,
  }));

  const lead = members[0];
  return {
    headId,
    leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() : headId,
    members: members.length,
    perPerson,
    otherCosts,
    grossSale,
    discount: totalDiscount,
    totalSale,
    refunds,
    netReceivable,
    totalPurchase,
    commission,
    netProfit: netReceivable - totalPurchase - commission,
    received,
    outstanding: Math.max(0, netReceivable - received),
    supplierPaid,
    supplierRemaining,
    memberList,
    linked,
    allocatedPurchases,
  };
}
