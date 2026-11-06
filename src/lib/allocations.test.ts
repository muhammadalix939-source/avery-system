import { describe, it, expect } from "vitest";
import {
  splitEqual,
  distributeProRata,
  rebalanceEqual,
  autoBalanceLast,
  validateAllocations,
  purchaseAllocations,
  headCostOf,
  agentOtherSaleRows,
  paymentAllocations,
  headSupplierPaid,
  agentSupplierPaid,
} from "./allocations";
import type { LedgerEntry, CostAllocation } from "./store";

describe("Cost and Payment Allocations", () => {
  it("1. splitEqual creates exact integer splits with first remainder getting +1", () => {
    expect(splitEqual(100000, 2)).toEqual([50000, 50000]);
    expect(splitEqual(100001, 3)).toEqual([33334, 33334, 33333]);

    // Invariant: sum always equals total for totals 0..1000 and counts 1..9
    for (let total = 0; total <= 1000; total += 25) {
      for (let count = 1; count <= 9; count++) {
        const parts = splitEqual(total, count);
        expect(parts).toHaveLength(count);
        const sum = parts.reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it("2. Equal split between Head A and Head B", () => {
    const lines: CostAllocation[] = [
      { id: "A1", target: "head", headId: "AV-HD-001", amount: 0 },
      { id: "A2", target: "head", headId: "AV-HD-002", amount: 0 },
    ];
    const balanced = rebalanceEqual(lines, 100000);
    expect(balanced.map((l) => l.amount)).toEqual([50000, 50000]);

    const entry: LedgerEntry = {
      id: "P001",
      date: "2026-03-01",
      type: "purchase",
      headId: "",
      referenceId: "SUP-01",
      referenceName: "Al Haram Hotels",
      amount: 100000,
      note: "Room booking",
      createdAt: "2026-03-01",
      allocations: balanced,
    };

    expect(headCostOf([entry], "AV-HD-001")).toBe(50000);
    expect(headCostOf([entry], "AV-HD-002")).toBe(50000);
  });

  it("3. Mixed manual allocation: Head A, Head B, Agent X", () => {
    const allocations: CostAllocation[] = [
      { id: "A1", target: "head", headId: "AV-HD-001", amount: 40000 },
      { id: "A2", target: "head", headId: "AV-HD-002", amount: 30000 },
      { id: "A3", target: "agent", agentId: "AV-A001", amount: 20000, saleAmount: 24000, forClientName: "Zahid" },
    ];

    const ctx = {
      heads: new Set(["AV-HD-001", "AV-HD-002"]),
      agents: new Set(["AV-A001"]),
      membersOf: () => new Set<string>(),
    };
    const val = validateAllocations(allocations, 90000, ctx);
    expect(val.ok).toBe(true);

    const entry: LedgerEntry = {
      id: "P002",
      date: "2026-03-02",
      type: "purchase",
      headId: "",
      referenceId: "SUP-01",
      referenceName: "Supplier",
      amount: 90000,
      note: "Flight tickets",
      createdAt: "2026-03-02",
      allocations,
    };

    expect(headCostOf([entry], "AV-HD-001")).toBe(40000);
    expect(headCostOf([entry], "AV-HD-002")).toBe(30000);

    const agentRows = agentOtherSaleRows([entry], "AV-A001");
    expect(agentRows).toHaveLength(1);
    expect(agentRows[0].sale).toBe(24000);
    expect(agentRows[0].cost).toBe(20000);
    expect(agentRows[0].profit).toBe(4000);
  });

  it("4. 1 Head + 1 Agent, default saleAmount equals cost", () => {
    const allocations: CostAllocation[] = [
      { id: "A1", target: "head", headId: "AV-HD-001", amount: 60000 },
      { id: "A2", target: "agent", agentId: "AV-A001", amount: 40000 },
    ];
    const entry: LedgerEntry = {
      id: "P003",
      date: "2026-03-03",
      type: "purchase",
      headId: "",
      referenceId: "SUP-01",
      referenceName: "Supplier",
      amount: 100000,
      note: "Visa package",
      createdAt: "2026-03-03",
      allocations,
    };

    expect(headCostOf([entry], "AV-HD-001")).toBe(60000);
    const agentRows = agentOtherSaleRows([entry], "AV-A001");
    expect(agentRows).toHaveLength(1);
    expect(agentRows[0].sale).toBe(40000);
    expect(agentRows[0].cost).toBe(40000);
    expect(agentRows[0].profit).toBe(0);
  });

  it("5. Rebalancing in Equal mode preserves locks and updates unlocked", () => {
    const lines: CostAllocation[] = [
      { id: "A1", target: "head", headId: "AV-HD-001", amount: 60000 },
      { id: "A2", target: "agent", agentId: "AV-A001", amount: 40000 },
    ];
    const rebalanced = rebalanceEqual(lines, 70000);
    expect(rebalanced.map((l) => l.amount)).toEqual([35000, 35000]);

    // With a lock
    const lockedLines: CostAllocation[] = [
      { id: "A1", target: "head", headId: "AV-HD-001", amount: 20000, locked: true },
      { id: "A2", target: "head", headId: "AV-HD-002", amount: 0 },
      { id: "A3", target: "agent", agentId: "AV-A001", amount: 0 },
    ];
    const rebalancedWithLock = rebalanceEqual(lockedLines, 70000);
    expect(rebalancedWithLock.map((l) => l.amount)).toEqual([20000, 25000, 25000]);
  });

  it("6. autoBalanceLast puts remaining amount on the last line", () => {
    const lines: CostAllocation[] = [
      { id: "A1", target: "head", headId: "AV-HD-001", amount: 30000 },
      { id: "A2", target: "head", headId: "AV-HD-002", amount: 20000 },
      { id: "A3", target: "agent", agentId: "AV-A001", amount: 0 },
    ];
    const balanced = autoBalanceLast(lines, 90000);
    expect(balanced[2].amount).toBe(40000);
  });

  it("7. Legacy data adapter preserves exact figures for unmigrated entries", () => {
    const legacyClientPurchase: LedgerEntry = {
      id: "LEG-1",
      date: "2026-01-01",
      type: "purchase",
      headId: "AV-HD-001",
      purchasedFor: "client",
      clientId: "AV-C001",
      referenceId: "SUP-1",
      referenceName: "Supplier",
      amount: 45000,
      note: "Old booking",
      createdAt: "2026-01-01",
    };
    expect(headCostOf([legacyClientPurchase], "AV-HD-001")).toBe(45000);

    const legacyAgentPurchase: LedgerEntry = {
      id: "LEG-2",
      date: "2026-01-02",
      type: "purchase",
      headId: "",
      purchasedFor: "agent",
      agentId: "AV-A001",
      saleAmount: 50000,
      referenceId: "SUP-1",
      referenceName: "Supplier",
      amount: 40000,
      note: "Old agent ticket",
      createdAt: "2026-01-02",
    };
    const agentRows = agentOtherSaleRows([legacyAgentPurchase], "AV-A001");
    expect(agentRows).toHaveLength(1);
    expect(agentRows[0].sale).toBe(50000);
    expect(agentRows[0].cost).toBe(40000);
    expect(agentRows[0].profit).toBe(10000);

    const legacyOfficePurchase: LedgerEntry = {
      id: "LEG-3",
      date: "2026-01-03",
      type: "purchase",
      headId: "",
      referenceId: "SUP-1",
      referenceName: "Supplier",
      amount: 15000,
      note: "Stock",
      createdAt: "2026-01-03",
    };
    expect(headCostOf([legacyOfficePurchase], "AV-HD-001")).toBe(0);
    expect(agentOtherSaleRows([legacyOfficePurchase], "AV-A001")).toHaveLength(0);
  });

  it("8 & 9. Supplier payment allocations and Group pro-rating", () => {
    // Group G has two purchases: Head A (30,000) and Head B (10,000) -> total group bill = 40,000
    const groupPurchases: LedgerEntry[] = [
      {
        id: "P-G1",
        date: "2026-03-01",
        type: "purchase",
        headId: "AV-HD-A",
        groupId: "GRP-1",
        referenceId: "SUP-1",
        referenceName: "Supplier",
        amount: 30000,
        note: "Head A group room",
        createdAt: "2026-03-01",
      },
      {
        id: "P-G2",
        date: "2026-03-01",
        type: "purchase",
        headId: "AV-HD-B",
        groupId: "GRP-1",
        referenceId: "SUP-1",
        referenceName: "Supplier",
        amount: 10000,
        note: "Head B group room",
        createdAt: "2026-03-01",
      },
    ];

    // Supplier payment: 60,000 total:
    // Head A 30,000 + Group GRP-1 20,000 + Agent X 10,000
    const paymentEntry: LedgerEntry = {
      id: "PAY-1",
      date: "2026-03-05",
      type: "supplier_payment",
      headId: "",
      referenceId: "SUP-1",
      referenceName: "Supplier",
      amount: 60000,
      note: "Batch supplier payment",
      createdAt: "2026-03-05",
      paymentAllocations: [
        { id: "P1", target: "head", headId: "AV-HD-A", amount: 30000 },
        { id: "P2", target: "group", groupId: "GRP-1", amount: 20000 },
        { id: "P3", target: "agent", agentId: "AV-A001", amount: 10000 },
      ],
    };

    const allEntries = [...groupPurchases, paymentEntry];

    // Head A supplierPaid = 30,000 (direct) + 20,000 * (30,000 / 40,000) = 30,000 + 15,000 = 45,000
    expect(headSupplierPaid(allEntries, "AV-HD-A")).toBe(45000);

    // Head B supplierPaid = 0 (direct) + 20,000 * (10,000 / 40,000) = 5,000
    expect(headSupplierPaid(allEntries, "AV-HD-B")).toBe(5000);

    // Agent X memo figure
    expect(agentSupplierPaid(allEntries, "AV-A001")).toBe(10000);
  });

  it("10. Validation detects duplicate targets and sum mismatches", () => {
    const ctx = {
      heads: new Set(["AV-HD-001"]),
      agents: new Set(["AV-A001"]),
      membersOf: (h: string) => (h === "AV-HD-001" ? new Set(["AV-C001", "AV-C002"]) : new Set<string>()),
    };

    // Sum mismatch
    const badSum = validateAllocations(
      [{ id: "A1", target: "head", headId: "AV-HD-001", amount: 40000 }],
      50000,
      ctx
    );
    expect(badSum.ok).toBe(false);
    expect(badSum.remaining).toBe(10000);

    // Duplicate head lines without distinct clientId
    const dupHead = validateAllocations(
      [
        { id: "A1", target: "head", headId: "AV-HD-001", amount: 25000 },
        { id: "A2", target: "head", headId: "AV-HD-001", amount: 25000 },
      ],
      50000,
      ctx
    );
    expect(dupHead.ok).toBe(false);
    expect(dupHead.errors[0]).toContain("Duplicate allocation for Head AV-HD-001");

    // Same head with distinct clientIds is ALLOWED
    const validMembers = validateAllocations(
      [
        { id: "A1", target: "head", headId: "AV-HD-001", clientId: "AV-C001", amount: 25000 },
        { id: "A2", target: "head", headId: "AV-HD-001", clientId: "AV-C002", amount: 25000 },
      ],
      50000,
      ctx
    );
    expect(validMembers.ok).toBe(true);
  });

  it("11. distributeProRata largest remainder method handles edge cases cleanly", () => {
    const distributed = distributeProRata(20000, [30000, 10000]);
    expect(distributed).toEqual([15000, 5000]);

    // Odd division
    const odd = distributeProRata(100, [33, 33, 34]);
    expect(odd.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
