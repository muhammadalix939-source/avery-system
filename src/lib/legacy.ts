/**
 * Backward-compatibility layer for restored / older backups.
 * Old records keep their original meaning; missing fields get safe defaults
 * so new features never produce NaN or crash. Pure functions — easy to test.
 */
import type { Booking, Client } from "./data";
import type { LedgerEntry, Account } from "./store";

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeEntry(e: Partial<LedgerEntry> & Record<string, unknown>, i = 0): LedgerEntry {
  return {
    ...e,
    id: String(e.id || `E-LEGACY-${i + 1}`),
    date: String(e.date || (typeof e.createdAt === "string" ? e.createdAt.slice(0, 10) : "") || "2026-01-01"),
    type: (e.type || "expense") as LedgerEntry["type"],
    headId: String(e.headId || ""),
    referenceId: String(e.referenceId || ""),
    referenceName: String(e.referenceName || ""),
    amount: num(e.amount),
    note: String(e.note || ""),
    createdAt: String(e.createdAt || e.date || "2026-01-01T00:00:00"),
  } as LedgerEntry;
}

export function normalizeBooking(b: Partial<Booking> & Record<string, unknown>): Booking {
  return {
    ...b,
    totalAmount: num(b.totalAmount),
    amountReceived: num(b.amountReceived),
    totalCost: num(b.totalCost),
    commission: num(b.commission),
    members: num(b.members),
    clientIds: arr<string>(b.clientIds),
    hotels: arr(b.hotels),
    flights: arr(b.flights),
    transports: arr(b.transports),
    visas: arr(b.visas),
    others: arr(b.others),
    ziyarahs: arr(b.ziyarahs),
    packageInfo: b.packageInfo
      ? { ...(b.packageInfo as Record<string, unknown>), inclusions: arr<string>((b.packageInfo as { inclusions?: unknown }).inclusions) } as Booking["packageInfo"]
      : undefined,
  } as Booking;
}

export function normalizeClient(c: Partial<Client> & Record<string, unknown>): Client {
  return { ...c, amountDue: num(c.amountDue), amountPaid: num(c.amountPaid) } as Client;
}

/** True when an entry was recorded before account / payment-method tracking existed. */
export function isLegacyMoneyEntry(e: Pick<LedgerEntry, "accountId" | "paymentMethod">): boolean {
  return !e.accountId && !e.paymentMethod;
}

/** Re-create any account that entries still point to but was deleted / missing in the backup. */
export function restoreMissingAccounts(accounts: Account[], entries: LedgerEntry[]): Account[] {
  const have = new Set(accounts.map((a) => a.id));
  const out = accounts.map((a) => ({ ...a, openingBalance: num(a.openingBalance) }));
  for (const e of entries) {
    const id = e.accountId;
    if (id && !have.has(id)) {
      have.add(id);
      out.push({ id, name: `Recovered ${id}`, type: "Cash", openingBalance: 0, openingDate: "2026-01-01" } as Account);
    }
  }
  return out;
}
