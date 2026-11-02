import { describe, it, expect } from "vitest";
import { normalizeEntry, normalizeBooking, isLegacyMoneyEntry, restoreMissingAccounts } from "./legacy";

describe("legacy backup compatibility", () => {
  it("bad or missing amounts become 0, never NaN", () => {
    expect(normalizeEntry({ amount: "1,50,000" as never }).amount).toBe(150000);
    expect(normalizeEntry({ amount: undefined }).amount).toBe(0);
    expect(normalizeBooking({ totalAmount: "abc" as never }).totalAmount).toBe(0);
  });
  it("old bookings get empty service lists", () => {
    expect(normalizeBooking({}).hotels).toEqual([]);
  });
  it("entries without account and method are legacy (not counted as Cash)", () => {
    expect(isLegacyMoneyEntry({ accountId: undefined, paymentMethod: undefined })).toBe(true);
    expect(isLegacyMoneyEntry({ accountId: "AC-001", paymentMethod: "Cash" })).toBe(false);
  });
  it("deleted accounts still referenced by entries are recovered", () => {
    const out = restoreMissingAccounts([], [normalizeEntry({ accountId: "AC-002", amount: 5 })]);
    expect(out.map((a) => a.id)).toEqual(["AC-002"]);
  });
});
