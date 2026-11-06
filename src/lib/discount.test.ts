import { describe, it, expect } from "vitest";
import { computeBookingFinancials, distributePayment, type Booking, type Client } from "./data";
import { computeHeadBusiness } from "./heads";
import type { LedgerEntry } from "./store";

describe("Client Discount & Receivable Logic (300,000 with 5,000 discount = 295,000 customer due)", () => {
  it("computeBookingFinancials calculates net clientPayable as 295,000 from 300,000 gross with 5,000 discount", () => {
    const booking: Booking = {
      id: "B-TEST",
      headId: "HD-TEST-1",
      agentId: "Direct",
      baseAmount: 300000,
      totalAmount: 295000,
      amountReceived: 0,
      totalCost: 200000,
      commission: 0,
      discount: 5000,
      discountSettlement: "agency_absorbed",
      clientIds: ["C-1"],
      status: "Confirmed",
      packageType: "Umrah",
      travelDate: "2026-06-01",
      createdAt: "2026-05-01",
      members: 1,
    };

    const fin = computeBookingFinancials(booking);
    expect(fin.grossSale).toBe(300000);
    expect(fin.discount).toBe(5000);
    expect(fin.clientPayable).toBe(295000);
    expect(fin.sale).toBe(295000);
    // Agency absorbed 5,000 discount: net profit = 300,000 - 5,000 - 200,000 = 95,000
    expect(fin.netProfit).toBe(95000);
  });

  it("distributePayment satisfies full payment at 295,000 net customer due", () => {
    const singleClient: Client[] = [
      {
        id: "C-1",
        headId: "HD-TEST-1",
        firstName: "Test",
        lastName: "Client",
        gender: "Male",
        phone: "03001234567",
        packageType: "Umrah",
        paymentStatus: "Unpaid",
        baseDue: 300000,
        amountDue: 295000,
        amountPaid: 0,
      },
    ];

    // Partial payment of 100,000:
    const partial = distributePayment(singleClient, 100000);
    expect(partial[0].amountPaid).toBe(100000);
    expect(partial[0].amountDue - partial[0].amountPaid).toBe(195000);
    expect(partial[0].paymentStatus).toBe("Partial");

    // Full payment of 295,000:
    const full = distributePayment(singleClient, 295000);
    expect(full[0].amountPaid).toBe(295000);
    expect(full[0].amountDue - full[0].amountPaid).toBe(0);
    expect(full[0].paymentStatus).toBe("Paid");
  });

  it("multi-member head splits 295,000 net due across 5 members to exactly 59,000 each", () => {
    const members: Client[] = Array.from({ length: 5 }, (_, i) => ({
      id: `C-${i + 1}`,
      headId: "HD-MULTI",
      firstName: `Member`,
      lastName: `${i + 1}`,
      gender: "Male",
      phone: "03001234567",
      packageType: "Umrah",
      paymentStatus: "Unpaid" as const,
      baseDue: 60000,
      amountDue: 59000,
      amountPaid: 0,
    }));

    const totalDue = members.reduce((sum, c) => sum + c.amountDue, 0);
    expect(totalDue).toBe(295000);

    // Distributing 295,000 marks all 5 members Paid
    const distributed = distributePayment(members, 295000);
    expect(distributed.every((c) => c.paymentStatus === "Paid")).toBe(true);
    expect(distributed.reduce((sum, c) => sum + c.amountPaid, 0)).toBe(295000);
  });

  it("computeHeadBusiness reflects grossSale 300,000, discount 5,000, and netReceivable 295,000", () => {
    const booking: Booking = {
      id: "B-HB",
      headId: "HD-HB-1",
      agentId: "Direct",
      baseAmount: 300000,
      totalAmount: 295000,
      amountReceived: 100000,
      totalCost: 180000,
      commission: 0,
      discount: 5000,
      clientIds: ["C-HB-1"],
      status: "Confirmed",
      packageType: "Umrah",
      travelDate: "2026-06-01",
      createdAt: "2026-05-01",
      members: 1,
    };

    const clients: Client[] = [
      {
        id: "C-HB-1",
        headId: "HD-HB-1",
        firstName: "Head",
        lastName: "Leader",
        gender: "Male",
        phone: "03000000000",
        packageType: "Umrah",
        paymentStatus: "Partial",
        baseDue: 300000,
        amountDue: 295000,
        amountPaid: 100000,
      },
    ];

    const entries: LedgerEntry[] = [
      {
        id: "E-REC-1",
        date: "2026-05-02",
        type: "client_receive",
        headId: "HD-HB-1",
        amount: 100000,
        referenceId: "HD-HB-1",
        note: "Initial deposit",
        createdAt: "2026-05-02T10:00:00",
      },
    ];

    const hb = computeHeadBusiness("HD-HB-1", clients, [booking], entries);
    expect(hb.grossSale).toBe(300000);
    expect(hb.discount).toBe(5000);
    expect(hb.totalSale).toBe(295000);
    expect(hb.netReceivable).toBe(295000);
    expect(hb.received).toBe(100000);
    expect(hb.outstanding).toBe(195000);
    expect(hb.memberList[0].pending).toBe(195000);
  });
});
