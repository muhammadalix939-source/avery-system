// Pure Cost and Payment Allocation engine for Avery CRM.
// Zero dependencies, fully typed, deterministic calculations.
import type { CostAllocation, PaymentAllocation, LedgerEntry } from "./store";

/**
 * Split an integer total equally across count lines.
 * Base = floor(total / count), remainder r = total - base * count.
 * The FIRST r lines get +1.
 * Sum is guaranteed to equal total for all integer totals and counts.
 */
export function splitEqual(total: number, count: number): number[] {
  if (count <= 0) return [];
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));
  if (count === 1) return [safeTotal];
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal - base * count;
  const result: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = base + (i < remainder ? 1 : 0);
  }
  return result;
}

/**
 * Largest-remainder (Hamilton-Hare) method for distributing an integer total
 * proportionally according to weights. Sum is strictly guaranteed to equal total.
 */
export function distributeProRata(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));
  if (weights.length === 1) return [safeTotal];

  const sumWeights = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (sumWeights <= 0 || safeTotal === 0) {
    return splitEqual(safeTotal, weights.length);
  }

  const exacts: number[] = [];
  const floors: number[] = [];
  const fractions: Array<{ index: number; fraction: number }> = [];

  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, weights[i] || 0);
    const exact = (safeTotal * w) / sumWeights;
    const fl = Math.floor(exact);
    exacts.push(exact);
    floors.push(fl);
    fractions.push({ index: i, fraction: exact - fl });
  }

  const currentSum = floors.reduce((s, f) => s + f, 0);
  const remainder = safeTotal - currentSum;

  // Sort descending by fraction, tie-break by original index
  fractions.sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    return a.index - b.index;
  });

  const result = [...floors];
  for (let i = 0; i < remainder && i < fractions.length; i++) {
    result[fractions[i].index] += 1;
  }

  return result;
}

/**
 * Rebalances unlocked allocation lines equally so the total of all lines equals `total`.
 * Locked lines maintain their current amounts.
 */
export function rebalanceEqual(lines: CostAllocation[], total: number): CostAllocation[] {
  if (lines.length === 0) return [];
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));

  const lockedSum = lines.filter((l) => l.locked).reduce((s, l) => s + (l.amount || 0), 0);
  const unlockedIndices = lines.map((l, i) => (!l.locked ? i : -1)).filter((i) => i !== -1);

  if (unlockedIndices.length === 0) {
    return lines;
  }

  const available = Math.max(0, safeTotal - lockedSum);
  const splits = splitEqual(available, unlockedIndices.length);

  return lines.map((line, idx) => {
    if (line.locked) return line;
    const uPos = unlockedIndices.indexOf(idx);
    const newAmt = splits[uPos];
    const updated: CostAllocation = {
      ...line,
      amount: newAmt,
    };
    if (line.target === "agent") {
      // Default saleAmount to new amount if unset
      updated.saleAmount = line.saleAmount !== undefined ? line.saleAmount : newAmt;
    }
    return updated;
  });
}

/**
 * Manual helper: sets (total - sum of other lines) on the last unlocked line.
 */
export function autoBalanceLast(lines: CostAllocation[], total: number): CostAllocation[] {
  if (lines.length === 0) return [];
  const safeTotal = Math.max(0, Math.round(Number(total) || 0));

  let targetIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].locked) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx === -1) {
    targetIdx = lines.length - 1;
  }

  const otherSum = lines.reduce((s, l, i) => (i === targetIdx ? s : s + (l.amount || 0)), 0);
  const remainder = Math.max(0, safeTotal - otherSum);

  return lines.map((line, i) => {
    if (i !== targetIdx) return line;
    const updated: CostAllocation = {
      ...line,
      amount: remainder,
    };
    if (line.target === "agent" && line.saleAmount === undefined) {
      updated.saleAmount = remainder;
    }
    return updated;
  });
}

export interface ValidationContext {
  heads: Set<string>;
  agents: Set<string>;
  membersOf: (headId: string) => Set<string>;
}

/**
 * Validates a cost allocation breakdown.
 */
export function validateAllocations(
  lines: CostAllocation[],
  total: number,
  ctx: ValidationContext
): { ok: boolean; errors: string[]; remaining: number } {
  const errors: string[] = [];
  const safeTotal = Math.round(Number(total) || 0);

  if (!lines || lines.length === 0) {
    return { ok: false, errors: ["At least one allocation line is required"], remaining: safeTotal };
  }

  const sum = lines.reduce((s, l) => s + (l.amount || 0), 0);
  const remaining = safeTotal - sum;

  if (remaining !== 0) {
    errors.push(`Total allocated (${sum.toLocaleString()} PKR) does not match purchase amount (${safeTotal.toLocaleString()} PKR). Remaining: ${remaining.toLocaleString()} PKR`);
  }

  const seenTargets = new Set<string>();

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    if (!line.amount || line.amount <= 0 || !Number.isInteger(line.amount)) {
      errors.push(`Line ${lineNum}: Amount must be a positive whole PKR integer.`);
    }

    if (line.target === "head") {
      if (!line.headId) {
        errors.push(`Line ${lineNum}: Please select a client Head.`);
      } else if (!ctx.heads.has(line.headId)) {
        errors.push(`Line ${lineNum}: Unknown client Head (${line.headId}).`);
      } else if (line.clientId) {
        const members = ctx.membersOf(line.headId);
        if (!members.has(line.clientId)) {
          errors.push(`Line ${lineNum}: Client member ${line.clientId} does not belong to Head ${line.headId}.`);
        }
      }

      // Check duplicates: same head twice without distinguishing clientId is an error
      const key = `head:${line.headId || ""}:${line.clientId || "ALL"}`;
      if (seenTargets.has(key)) {
        errors.push(`Line ${lineNum}: Duplicate allocation for Head ${line.headId}${line.clientId ? ` (member ${line.clientId})` : ""}. Combine amounts instead.`);
      }
      seenTargets.add(key);
    } else if (line.target === "agent") {
      if (!line.agentId) {
        errors.push(`Line ${lineNum}: Please select an Agent.`);
      } else if (!ctx.agents.has(line.agentId)) {
        errors.push(`Line ${lineNum}: Unknown Agent (${line.agentId}).`);
      }

      if (line.saleAmount !== undefined && (line.saleAmount < 0 || !Number.isInteger(line.saleAmount))) {
        errors.push(`Line ${lineNum}: Agent sale amount must be non-negative whole PKR.`);
      }

      const key = `agent:${line.agentId || ""}`;
      if (seenTargets.has(key)) {
        errors.push(`Line ${lineNum}: Duplicate allocation for Agent ${line.agentId}. Combine amounts instead.`);
      }
      seenTargets.add(key);
    } else if (line.target === "office") {
      const key = "office";
      if (seenTargets.has(key)) {
        errors.push(`Line ${lineNum}: Duplicate Office / Stock line. Combine amounts instead.`);
      }
      seenTargets.add(key);
    } else {
      errors.push(`Line ${lineNum}: Invalid allocation target "${(line as any).target}".`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    remaining,
  };
}

/**
 * Pure Legacy Adapter for Purchase Cost Allocations.
 * If e.allocations is present and non-empty, returns it.
 * Otherwise synthesizes ONE line from legacy fields.
 */
export function purchaseAllocations(e: LedgerEntry): CostAllocation[] {
  if (e.allocations && e.allocations.length > 0) {
    return e.allocations;
  }

  const amt = Number(e.amount) || 0;

  if (e.purchasedFor === "client" && e.headId) {
    return [
      {
        id: "A1",
        target: "head",
        headId: e.headId,
        ...(e.clientId ? { clientId: e.clientId } : {}),
        amount: amt,
      },
    ];
  }

  if (e.purchasedFor === "agent" && e.agentId) {
    return [
      {
        id: "A1",
        target: "agent",
        agentId: e.agentId,
        amount: amt,
        saleAmount: e.saleAmount ?? amt,
        ...(e.forClientName ? { forClientName: e.forClientName } : {}),
      },
    ];
  }

  if (e.headId) {
    return [
      {
        id: "A1",
        target: "head",
        headId: e.headId,
        ...(e.clientId ? { clientId: e.clientId } : {}),
        amount: amt,
      },
    ];
  }

  return [
    {
      id: "A1",
      target: "office",
      amount: amt,
    },
  ];
}

/**
 * Computes total cost allocated to a specific client Head across all purchases.
 */
export function headCostOf(entries: LedgerEntry[], headId: string): number {
  if (!headId) return 0;
  return entries.reduce((sum, e) => {
    if (e.type !== "purchase") return sum;
    const lines = purchaseAllocations(e);
    const headLines = lines.filter((l) => l.target === "head" && l.headId === headId);
    return sum + headLines.reduce((s, l) => s + (l.amount || 0), 0);
  }, 0);
}

export interface AgentOtherSaleRow {
  entry: LedgerEntry;
  line?: CostAllocation;
  sale: number;
  cost: number;
  profit: number;
}

/**
 * Computes all Other Sale rows for an Agent (both purchase agent lines and direct other_sale entries).
 */
export function agentOtherSaleRows(entries: LedgerEntry[], agentId: string): AgentOtherSaleRow[] {
  if (!agentId) return [];
  const rows: AgentOtherSaleRow[] = [];

  entries.forEach((e) => {
    if (e.type === "purchase") {
      const lines = purchaseAllocations(e);
      lines.forEach((line) => {
        if (line.target === "agent" && line.agentId === agentId) {
          const cost = line.amount || 0;
          const sale = line.saleAmount !== undefined ? line.saleAmount : cost;
          rows.push({
            entry: e,
            line,
            sale,
            cost,
            profit: sale - cost,
          });
        }
      });
    } else if (e.type === "other_sale" && e.referenceId === agentId) {
      const sale = Number(e.amount) || 0;
      rows.push({
        entry: e,
        sale,
        cost: 0,
        profit: sale,
      });
    }
  });

  return rows.sort((a, b) => (a.entry.date || "").localeCompare(b.entry.date || ""));
}

/**
 * Pure Legacy Adapter for Supplier Payment Allocations.
 */
export function paymentAllocations(e: LedgerEntry): PaymentAllocation[] {
  if (e.paymentAllocations && e.paymentAllocations.length > 0) {
    return e.paymentAllocations;
  }

  const amt = Number(e.amount) || 0;

  if (e.headId) {
    return [{ id: "P1", target: "head", headId: e.headId, amount: amt }];
  }

  if (e.groupId) {
    return [{ id: "P1", target: "group", groupId: e.groupId, amount: amt }];
  }

  if (e.agentId) {
    return [{ id: "P1", target: "agent", agentId: e.agentId, amount: amt }];
  }

  return [{ id: "P1", target: "unallocated", amount: amt }];
}

/**
 * Computes supplier payments made on behalf of a specific Head:
 *  1) Direct head allocations on supplier_payment entries
 *  2) Group allocations prorated by this Head's share of the Group's allocated purchase bill
 */
export function headSupplierPaid(entries: LedgerEntry[], headId: string): number {
  if (!headId) return 0;

  const paymentEntries = entries.filter((e) => e.type === "supplier_payment");
  const purchaseEntries = entries.filter((e) => e.type === "purchase");

  // 1) Direct head lines
  let directPaid = 0;
  // Map of groupId -> total group payments
  const groupPaidMap = new Map<string, number>();

  paymentEntries.forEach((p) => {
    const lines = paymentAllocations(p);
    lines.forEach((l) => {
      if (l.target === "head" && l.headId === headId) {
        directPaid += l.amount || 0;
      } else if (l.target === "group" && l.groupId) {
        groupPaidMap.set(l.groupId, (groupPaidMap.get(l.groupId) || 0) + (l.amount || 0));
      }
    });
  });

  // 2) Prorated group payments
  let proratedPaid = 0;
  groupPaidMap.forEach((groupPaymentTotal, gid) => {
    const groupPurchases = purchaseEntries.filter((p) => p.groupId === gid);
    const groupBill = groupPurchases.reduce((s, p) => s + (p.amount || 0), 0);
    if (groupBill <= 0) return;

    const headCostInGroup = groupPurchases.reduce((sum, p) => {
      const lines = purchaseAllocations(p).filter((l) => l.target === "head" && l.headId === headId);
      return sum + lines.reduce((s, l) => s + (l.amount || 0), 0);
    }, 0);

    if (headCostInGroup > 0) {
      proratedPaid += groupPaymentTotal * (headCostInGroup / groupBill);
    }
  });

  return Math.round(directPaid + proratedPaid);
}

/**
 * Memo figure only: supplier money paid on that agent's behalf.
 * Never affects agent receivables or collections.
 */
export function agentSupplierPaid(entries: LedgerEntry[], agentId: string): number {
  if (!agentId) return 0;
  return entries.reduce((sum, e) => {
    if (e.type !== "supplier_payment") return sum;
    const lines = paymentAllocations(e);
    const agentLines = lines.filter((l) => l.target === "agent" && l.agentId === agentId);
    return sum + agentLines.reduce((s, l) => s + (l.amount || 0), 0);
  }, 0);
}
