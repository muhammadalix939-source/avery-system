// Centralized state management for the CRM
import { useState, useCallback, useEffect } from "react";
import type { Client, Booking, Agent, Supplier, HotelService, FlightService, TransportService, VisaService, OtherService, ChecklistItem } from "./data";
import { mockClients, mockBookings, mockAgents, mockSuppliers, mockMonthlyData as defaultMonthlyData, generateId } from "./data";
import { defaultChecklist } from "./checklist";
import { getPKTDate } from "./date-utils";

export interface LedgerEntry {
  id: string;
  date: string;
  type:
    | "client_receive"
    | "supplier_payment"
    | "agent_commission"
    | "agent_receive"
    | "expense"
    | "purchase"
    | "client_charge"
    | "client_refund"
    | "supplier_refund"
    | "other_sale"
    | "gift"
    | "drawing";
  headId: string;
  referenceId: string; // client/supplier/agent ID
  referenceName: string;
  amount: number;
  note: string;
  createdAt: string;
  /** Optional PNR / batch group linking multiple purchases (typically flights or hotel rooming) */
  groupId?: string;
  /** Optional agent reference — which agent this money relates to (supplier payment, receipt, refund) */
  agentId?: string;
  /** Free-text reference of who physically paid / received (agent, client, office, bank) */
  paidBy?: string;
  /** Extra charge / refund metadata */
  clientId?: string;          // specific member the charge / refund belongs to
  chargeCategory?: string;    // Embassy Fee, Visa Fee, Ticket Change, Service Charge...
  refundOf?: string;          // original ledger entry ID this refund reverses
  refundReason?: string;
  /** Physical money account this transaction moved through (Cash / Bank / Wallet). */
  accountId?: string;
  /** Bank transfer / cheque / mobile wallet transaction reference number (required for non-Cash accounts). */
  txnRef?: string;
  /** How the money moved: Cash / Cheque / Bank Transfer / Online-Wallet. */
  paymentMethod?: "Cash" | "Cheque" | "Bank Transfer" | "Online / Wallet";
  chequeNo?: string;
  chequeDate?: string;
  bankName?: string;
  /** Who physically handed over / collected the money. */
  collectedBy?: string;
  /** Cash direction for account posting. */
  direction?: "in" | "out";
  /** Supplier ledger reconciliation state. */
  reconciled?: "recorded" | "matched" | "unmatched";
  /** Purchase entry: bought for an Agent or a Client head. */
  purchasedFor?: "agent" | "client";
  /** Purchase for agent: the end-client name this purchase was made for. */
  forClientName?: string;
  /** Purchase for agent: amount billed to the agent (Other Sale). Defaults to purchase amount. */
  saleAmount?: number;
  /** Purchase entry: also post the cost to the client personal ledger. */
  reflectInClientLedger?: boolean;
  /** Gift & Expense category. */
  giftCategory?: "Gift" | "Expense";
  /** Voucher / ticket / confirmation number printed on the supplier's document. */
  voucherNo?: string;
  /** Shared Cost Allocation: which specific members (within headId) share this purchase. */
  sharedClientIds?: string[];
  /** Equal = amount split evenly across sharedClientIds. Manual = clientSplits gives each person's share. */
  splitMethod?: "equal" | "manual";
  /** Manual per-person split amounts, keyed by client id. Must sum to `amount`. */
  clientSplits?: Record<string, number>;
  // For purchase entries: which service was bought (Hotel, Flight, Visa, Transport, Other)
  serviceCategory?: string;
  // Category-specific breakdown captured on purchase entries
  purchaseDetails?: {
    // Flight
    adults?: number;
    children?: number;
    infants?: number;
    adultPrice?: number;
    childPrice?: number;
    infantPrice?: number;
    // Hotel
    rooms?: number;
    perNight?: number;
    nights?: number;
    checkIn?: string;
    checkOut?: string;
    hotelName?: string;
    city?: string;
    // Visa
    visaType?: string;
    country?: string;
    reference?: string;
    // Transport
    route?: string;
    vehicle?: string;
    // Common
    description?: string;
  };
}

// ---------- Purchase Groups (PNR / batch) ----------
export interface PurchaseGroup {
  id: string;
  name: string;
  category: string; // Flight / Hotel / Visa / Transport / Other
  supplierId?: string;
  date?: string;         // scheduled / travel date
  pnr?: string;
  flightNumber?: string; // or schedule reference
  description?: string;
  totalPax?: number;     // optional capacity for the group (seats / rooms)
  createdAt: string;
}

// ---------- Accounts (Chart of Accounts) ----------
export interface Account {
  id: string;
  name: string;
  type: "Cash" | "Bank" | "Mobile Wallet";
  number?: string;
  branch?: string;
  openingBalance: number;
  openingDate: string;
}

export interface AccountLedgerRow {
  id: string;
  date: string;
  description: string;
  transactionType: LedgerEntry["type"];
  amount: number;
  direction: "in" | "out";
  runningBalanceAfter: number;
}

export interface AlertSettings {
  lowBalance: number;
  agentDueLimit: number;
  unmatchedDays: number;
  clientOverdueDays: number;
}

const defaultAlertSettings: AlertSettings = { lowBalance: 20000, agentDueLimit: 100000, unmatchedDays: 7, clientOverdueDays: 15 };

/** Money direction implied by an entry type (used for Account posting). */
export function entryDirection(type: LedgerEntry["type"]): "in" | "out" {
  return type === "client_receive" || type === "supplier_refund" || type === "other_sale" || type === "agent_receive" ? "in" : "out";
}

// ---------- Persistence (localStorage) ----------
const STORAGE_KEY = "av-crm-store-v1";

export interface OpeningBalances {
  revenue: number;
  pending: number;
  bookings: number;
  clients: number;
  supplierDue: number;
  profit: number;
  /** Legacy cost of sales already incurred before this system */
  cost?: number;
  /** Legacy operating expenses already incurred */
  expenses?: number;
  /** Legacy agent commission already earned by agents */
  commission?: number;
  /** Opening cash / bank balance */
  cash?: number;
  note?: string;
}

const defaultOpening: OpeningBalances = {
  revenue: 0, pending: 0, bookings: 0, clients: 0, supplierDue: 0, profit: 0,
  cost: 0, expenses: 0, commission: 0, cash: 0,
};

interface PersistedState {
  clients: Client[];
  bookings: Booking[];
  agents: Agent[];
  suppliers: Supplier[];
  monthlyData: typeof defaultMonthlyData;
  entries: LedgerEntry[];
  counters: { client: number; agent: number; supplier: number; booking: number; head: number; entry: number; group?: number };
  opening?: OpeningBalances;
  groups?: PurchaseGroup[];
  accounts?: Account[];
  alertSettings?: AlertSettings;
  readAlerts?: string[];
}

const defaultEntries: LedgerEntry[] = [
  { id: "E001", date: "2026-03-15", type: "client_receive", headId: "AV-HD-001", referenceId: "AV-C001", referenceName: "Muhammad Ali", amount: 100000, note: "Initial deposit", createdAt: "2026-03-15T10:00:00" },
  { id: "E002", date: "2026-03-20", type: "client_receive", headId: "AV-HD-001", referenceId: "AV-C002", referenceName: "Fatima Ali", amount: 100000, note: "Full payment", createdAt: "2026-03-20T14:30:00" },
  { id: "E003", date: "2026-03-25", type: "supplier_payment", headId: "", referenceId: "AV-S001", referenceName: "Al-Haram Hotels", amount: 200000, note: "Hotel advance", createdAt: "2026-03-25T11:00:00" },
  { id: "E004", date: "2026-04-01", type: "agent_commission", headId: "", referenceId: "AV-A001", referenceName: "Ahmed Khan", amount: 50000, note: "March commission", createdAt: "2026-04-01T09:00:00" },
  { id: "E005", date: "2026-04-05", type: "expense", headId: "", referenceId: "", referenceName: "Office Rent", amount: 30000, note: "Monthly office rent", createdAt: "2026-04-05T12:00:00" },
  { id: "E006", date: "2026-02-10", type: "client_receive", headId: "AV-HD-002", referenceId: "AV-C006", referenceName: "Zainab Raza", amount: 250000, note: "Full payment Hajj", createdAt: "2026-02-10T10:00:00" },
];

function loadState(): PersistedState {
  // Always start from the SSR-safe defaults so server and first client render match.
  // Persisted data is merged in after hydration via hydrateFromStorage().
  return {
    clients: [...mockClients], bookings: [...mockBookings], agents: [...mockAgents],
    suppliers: [...mockSuppliers], monthlyData: [...defaultMonthlyData], entries: defaultEntries,
    counters: { client: 11, agent: 4, supplier: 5, booking: 4, head: 4, entry: 7 },
  };
}

const initial = loadState();
let clients = initial.clients;
let bookings = initial.bookings;
let agents = initial.agents;
let suppliers = initial.suppliers;
let monthlyData = initial.monthlyData;
let entries: LedgerEntry[] = initial.entries;
let opening: OpeningBalances = initial.opening || { ...defaultOpening };
let groups: PurchaseGroup[] = initial.groups || [];
let accounts: Account[] = initial.accounts || [
  { id: "AC-001", name: "Main Cash", type: "Cash", openingBalance: 0, openingDate: "2026-01-01" },
];
let alertSettings: AlertSettings = initial.alertSettings || { ...defaultAlertSettings };
let readAlerts: string[] = initial.readAlerts || [];
let nextAccountNum = 2;
let nextClientNum = initial.counters.client;
let nextAgentNum = initial.counters.agent;
let nextSupplierNum = initial.counters.supplier;
let nextBookingNum = initial.counters.booking;
let nextHeadNum = initial.counters.head;
let nextEntryNum = initial.counters.entry;
let nextGroupNum = initial.counters.group || 1;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (typeof window === "undefined") return;
  if (!hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clients, bookings, agents, suppliers, monthlyData, entries, opening, groups, accounts, alertSettings, readAlerts,
        counters: { client: nextClientNum, agent: nextAgentNum, supplier: nextSupplierNum, booking: nextBookingNum, head: nextHeadNum, entry: nextEntryNum, group: nextGroupNum },
      }));
    } catch {}
  }, 150);
}

const listeners = new Set<() => void>();
function notify() { persist(); listeners.forEach((l) => l()); }

// ---------- Hydration (client-only, runs once after mount) ----------
let hydrated = false;
function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as PersistedState;
    clients = s.clients || clients;
    bookings = s.bookings || bookings;
    agents = s.agents || agents;
    suppliers = s.suppliers || suppliers;
    monthlyData = s.monthlyData || monthlyData;
    entries = s.entries || entries;
    opening = s.opening || opening;
    groups = s.groups || groups;
    if (s.accounts) accounts = s.accounts;
    if (s.alertSettings) alertSettings = { ...defaultAlertSettings, ...s.alertSettings };
    if (s.readAlerts) readAlerts = s.readAlerts;
    nextAccountNum = accounts.length + 1;
    if (s.counters) {
      nextClientNum = s.counters.client; nextAgentNum = s.counters.agent;
      nextSupplierNum = s.counters.supplier; nextBookingNum = s.counters.booking;
      nextHeadNum = s.counters.head; nextEntryNum = s.counters.entry;
      nextGroupNum = s.counters.group || nextGroupNum;
    }
  } catch {}
  // Persisted files may carry stale derived numbers — recompute from source of truth.
  resyncDerived();
  listeners.forEach((l) => l());
}

// ---------- Group capacity helper ----------
/** How many pax are already consumed by a given group — CLIENT members only.
 *  Supplier purchases / bills / expenses tagged to the group never consume seats. */
export function computeGroupUsedPax(groupId: string): number {
  return bookings
    .filter((b) => b.groupId === groupId)
    .reduce((sum, b) => {
      const memberCount = clients.filter((c) => c.headId === b.headId).length;
      return sum + (memberCount || b.members || 0);
    }, 0);
}

// ---------- Source-of-truth resync ----------
/** Agents are ALWAYS derived: sales / clients / commission come from bookings,
 *  paid commission comes from the ledger. Never mutated by deltas. */
function resyncAgents() {
  agents = agents.map((a) => {
    const ab = bookings.filter((b) => b.agentId === a.id);
    const heads = new Set(ab.map((b) => b.headId));
    const memberCount = clients.filter((c) => heads.has(c.headId)).length;
    return {
      ...a,
      totalSales: ab.reduce((s, b) => s + (b.totalAmount || 0), 0),
      totalClients: memberCount || ab.reduce((s, b) => s + (b.members || 0), 0),
      commission: ab.reduce((s, b) => s + (b.commission || 0), 0),
      paidCommission: entries.filter((e) => e.type === "agent_commission" && e.referenceId === a.id).reduce((s, e) => s + e.amount, 0),
    };
  });
}

/** Suppliers are derived from purchases / refunds / payments (booking cost as fallback). */
function resyncSuppliers() {
  suppliers = suppliers.map((s) => {
    const purchases = entries.filter((e) => e.type === "purchase" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
    const refunds = entries.filter((e) => e.type === "supplier_refund" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
    const payments = entries.filter((e) => e.type === "supplier_payment" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
    const bookingCost = bookings.filter((b) => b.supplierId === s.id).reduce((sum, b) => sum + (b.totalCost || 0), 0);
    return { ...s, totalPayable: Math.max(0, Math.max(purchases, bookingCost) - refunds), totalPaid: payments };
  });
}

/** Recompute everything that is derived. Cheap for CRM-sized data. */
function resyncDerived() { resyncSuppliers(); resyncAgents(); }

// Recompute derived totals on suppliers / agents / bookings from the entries array.
// Call after ANY entry add / update / delete so views and PDFs stay consistent.
function resyncFromEntries(refIds: { supplierIds?: string[]; agentIds?: string[]; headIds?: string[] }) {
  const headIds = new Set(refIds.headIds || []);

  // Suppliers & agents are fully derived — always recompute both.
  resyncDerived();

  // Bookings / clients: amountReceived = sum(client_receive entries for that head), redistribute to clients
  if (headIds.size) {
    headIds.forEach((headId) => {
      const gross = entries.filter((e) => e.type === "client_receive" && e.headId === headId).reduce((s, e) => s + e.amount, 0);
      const refundList = entries.filter((e) => e.type === "client_refund" && e.headId === headId);
      const refunded = refundList.reduce((s, e) => s + e.amount, 0);
      const charges = entries.filter((e) => e.type === "client_charge" && e.headId === headId);
      const chargeTotal = charges.reduce((s, e) => s + e.amount, 0);
      const totalReceived = Math.max(0, gross - refunded);

      bookings = bookings.map((b) => {
        if (b.headId !== headId) return b;
        const base = b.baseAmount ?? b.totalAmount;
        // A refund reduces the NET sale value of the booking (200,000 − 6,000 = 194,000)
        return {
          ...b, baseAmount: base, extraCharges: chargeTotal, refunded,
          totalAmount: Math.max(0, base + chargeTotal - refunded),
          amountReceived: totalReceived,
        };
      });

      // Push each extra charge / refund onto the member it belongs to
      // (unassigned ones hit the head/lead member). Refunds reduce that member's net due.
      const headClients = clients.filter((c) => c.headId === headId);
      const leadId = headClients[0]?.id;
      clients = clients.map((c) => {
        if (c.headId !== headId) return c;
        const extra = charges
          .filter((e) => (e.clientId ? e.clientId === c.id : c.id === leadId))
          .reduce((s, e) => s + e.amount, 0);
        const refund = refundList
          .filter((e) => (e.clientId ? e.clientId === c.id : c.id === leadId))
          .reduce((s, e) => s + e.amount, 0);
        const base = c.baseDue ?? c.amountDue;
        return { ...c, baseDue: base, extraCharges: extra, refunded: refund, amountDue: Math.max(0, base + extra - refund) };
      });

      let remaining = totalReceived;
      clients = clients.map((c) => {
        if (c.headId !== headId) return c;
        if (remaining <= 0) return { ...c, amountPaid: 0, paymentStatus: "Unpaid" as const };
        if (remaining >= c.amountDue) { remaining -= c.amountDue; return { ...c, amountPaid: c.amountDue, paymentStatus: "Paid" as const }; }
        const paid = remaining; remaining = 0;
        return { ...c, amountPaid: paid, paymentStatus: "Partial" as const };
      });
    });
  }
  // Booking totals may have shifted (charges / refunds) → agent sales follow.
  resyncAgents();
}

/** Live balance of an account: opening ± every posted transaction. */
export function computeAccountBalance(accountId: string): number {
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  return entries.filter((e) => e.accountId === accountId).reduce((bal, e) => {
    const dir = e.direction || entryDirection(e.type);
    return dir === "in" ? bal + e.amount : bal - e.amount;
  }, acc.openingBalance || 0);
}

/** Immutable, chronologically running ledger for one account. */
export function buildAccountLedger(accountId: string): AccountLedgerRow[] {
  const acc = accounts.find((a) => a.id === accountId);
  let running = acc?.openingBalance || 0;
  return entries
    .filter((e) => e.accountId === accountId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
    .map((e) => {
      const direction = e.direction || entryDirection(e.type);
      running = direction === "in" ? running + e.amount : running - e.amount;
      return {
        id: e.id, date: e.date,
        description: `${e.note || e.chargeCategory || e.type.replace(/_/g, " ")}${e.referenceName ? ` — ${e.referenceName}` : ""}`,
        transactionType: e.type, amount: e.amount, direction, runningBalanceAfter: running,
      };
    });
}

// ---------- Backup / Restore ----------
/** Full snapshot of the live data, ready to save as a .json file. */
export function exportBackup(): string {
  return JSON.stringify({
    system: "Avery CRM", version: 1, exportedAt: new Date().toISOString(),
    data: {
      clients, bookings, agents, suppliers, monthlyData, entries, opening, groups, accounts, alertSettings, readAlerts,
      counters: { client: nextClientNum, agent: nextAgentNum, supplier: nextSupplierNum, booking: nextBookingNum, head: nextHeadNum, entry: nextEntryNum, group: nextGroupNum },
    },
  }, null, 2);
}

export interface BackupSummary { clients: number; bookings: number; entries: number; agents: number; suppliers: number; groups: number; accounts: number }

/** Accepts every backup shape we've produced (plain store, {data}, {primaryStore}, {allStorage}). */
function extractStore(parsed: any): Partial<PersistedState> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const looks = (o: any) => o && typeof o === "object" && ["clients", "bookings", "entries", "agents", "suppliers", "accounts", "groups"].some((k) => Array.isArray(o[k]));
  if (looks(parsed.data)) return parsed.data;
  if (looks(parsed.primaryStore)) return parsed.primaryStore;
  if (typeof parsed.primaryStore === "string") { try { const p = JSON.parse(parsed.primaryStore); if (looks(p)) return p; } catch {} }
  if (parsed.allStorage && typeof parsed.allStorage[STORAGE_KEY] === "string") {
    try { const p = JSON.parse(parsed.allStorage[STORAGE_KEY]); if (looks(p)) return p; } catch {}
  }
  if (looks(parsed)) return parsed;
  return null;
}

export function summarizeBackup(text: string): BackupSummary | null {
  try {
    const s = extractStore(JSON.parse(text));
    if (!s) return null;
    const n = (a: unknown) => (Array.isArray(a) ? a.length : 0);
    return { clients: n(s.clients), bookings: n(s.bookings), entries: n(s.entries), agents: n(s.agents), suppliers: n(s.suppliers), groups: n(s.groups), accounts: n(s.accounts) };
  } catch { return null; }
}

/**
 * Restore a backup. mode "replace" = backup becomes the full data (missing sections become EMPTY, never demo data).
 * mode "merge" = only adds records whose ID isn't already present (safe for partial files like accounts-only).
 */
export function importBackup(text: string, mode: "replace" | "merge"): BackupSummary {
  const s = extractStore(JSON.parse(text));
  if (!s) throw new Error("This file has no CRM data in it.");
  const mergeById = <T extends { id: string }>(cur: T[], inc?: T[]) => {
    if (!Array.isArray(inc)) return cur;
    const ids = new Set(cur.map((x) => x.id));
    return [...cur, ...inc.filter((x) => x && !ids.has(x.id))];
  };
  if (mode === "replace") {
    clients = s.clients || []; bookings = s.bookings || []; agents = s.agents || []; suppliers = s.suppliers || [];
    entries = s.entries || []; groups = s.groups || []; accounts = s.accounts || [];
    monthlyData = s.monthlyData || monthlyData; opening = s.opening || { ...defaultOpening };
    if (s.alertSettings) alertSettings = { ...defaultAlertSettings, ...s.alertSettings };
    readAlerts = s.readAlerts || [];
  } else {
    clients = mergeById(clients, s.clients); bookings = mergeById(bookings, s.bookings); agents = mergeById(agents, s.agents);
    suppliers = mergeById(suppliers, s.suppliers); entries = mergeById(entries, s.entries); groups = mergeById(groups, s.groups);
    accounts = mergeById(accounts, s.accounts);
    if (s.opening) opening = s.opening;
  }
  // Counters: never go below what the data already uses, so new IDs never collide.
  const maxNum = (arr: { id: string }[]) => arr.reduce((m, x) => Math.max(m, Number(String(x.id).match(/(\d+)\D*$/)?.[1] || 0)), 0);
  const c = s.counters;
  nextClientNum = Math.max(c?.client || 0, maxNum(clients) + 1, nextClientNum * (mode === "merge" ? 1 : 0));
  nextAgentNum = Math.max(c?.agent || 0, maxNum(agents) + 1, mode === "merge" ? nextAgentNum : 0);
  nextSupplierNum = Math.max(c?.supplier || 0, maxNum(suppliers) + 1, mode === "merge" ? nextSupplierNum : 0);
  nextBookingNum = Math.max(c?.booking || 0, maxNum(bookings) + 1, mode === "merge" ? nextBookingNum : 0);
  nextHeadNum = Math.max(c?.head || 0, bookings.reduce((m, b) => Math.max(m, Number(String(b.headId).match(/(\d+)$/)?.[1] || 0)), 0) + 1, mode === "merge" ? nextHeadNum : 0);
  nextEntryNum = Math.max(c?.entry || 0, maxNum(entries) + 1, mode === "merge" ? nextEntryNum : 0);
  nextGroupNum = Math.max(c?.group || 0, maxNum(groups) + 1, mode === "merge" ? nextGroupNum : 0, 1);
  nextAccountNum = maxNum(accounts) + 1;
  hydrated = true;
  resyncDerived();
  notify();
  // Write immediately (not debounced) so a refresh right after restore keeps the data.
  try { localStorage.setItem(STORAGE_KEY, JSON.parse(JSON.stringify(exportBackup())) && JSON.stringify(JSON.parse(exportBackup()).data)); } catch {}
  return summarizeBackup(exportBackup())!;
}

export function useStore() {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    listeners.add(rerender);
    hydrateFromStorage();
    return () => { listeners.delete(rerender); };
  }, [rerender]);

  return {
    clients,
    bookings,
    agents,
    suppliers,
    monthlyData,
    entries,
    opening,
    groups,
    accounts,
    alertSettings,
    readAlerts,

    // Accounts (Chart of Accounts) CRUD
    addAccount: (data: Omit<Account, "id">) => {
      const id = `AC-${String(nextAccountNum++).padStart(3, "0")}`;
      accounts = [...accounts, { ...data, id }];
      notify();
      return id;
    },
    updateAccount: (id: string, data: Partial<Account>) => {
      accounts = accounts.map((a) => (a.id === id ? { ...a, ...data } : a));
      notify();
    },
    deleteAccount: (id: string) => {
      accounts = accounts.filter((a) => a.id !== id);
      notify();
    },
    setAlertSettings: (data: Partial<AlertSettings>) => {
      alertSettings = { ...alertSettings, ...data };
      notify();
    },
    markAlertRead: (id: string) => {
      if (!readAlerts.includes(id)) readAlerts = [...readAlerts, id];
      notify();
    },
    markAllAlertsRead: (ids: string[]) => {
      readAlerts = [...new Set([...readAlerts, ...ids])];
      notify();
    },
    /** Set the reconciliation state of a supplier purchase row. */
    setEntryReconciled: (id: string, state: "recorded" | "matched" | "unmatched") => {
      entries = entries.map((e) => (e.id === id ? { ...e, reconciled: state } : e));
      notify();
    },

    // Purchase Groups CRUD
    addGroup: (data: Omit<PurchaseGroup, "id" | "createdAt">) => {
      const id = `AV-G-${String(nextGroupNum++).padStart(3, "0")}`;
      const g: PurchaseGroup = { ...data, id, createdAt: new Date().toISOString() };
      groups = [...groups, g];
      notify();
      return id;
    },
    updateGroup: (id: string, data: Partial<PurchaseGroup>) => {
      groups = groups.map((g) => (g.id === id ? { ...g, ...data } : g));
      notify();
    },
    deleteGroup: (id: string) => {
      groups = groups.filter((g) => g.id !== id);
      entries = entries.map((e) => (e.groupId === id ? { ...e, groupId: undefined } : e));
      notify();
    },

    // Client CRUD
    addClient: (data: Omit<Client, "id">) => {
      const id = generateId("AV-C", nextClientNum++);
      clients = [...clients, { ...data, id, baseDue: data.amountDue, extraCharges: 0 }];
      resyncAgents();
      notify();
      return id;
    },
    updateClient: (id: string, data: Partial<Client>) => {
      clients = clients.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...data };
        if (data.amountDue !== undefined) {
          next.baseDue = data.amountDue;
          next.amountDue = data.amountDue + (c.extraCharges || 0);
        }
        return next;
      });
      notify();
    },
    deleteClient: (id: string) => {
      clients = clients.filter((c) => c.id !== id);
      bookings = bookings.map((b) => ({ ...b, clientIds: b.clientIds.filter((cid) => cid !== id) }));
      resyncAgents();
      notify();
    },

    // ---- Service Checklist CRUD (per client) ----
    addChecklistItem: (clientId: string, label: string) => {
      const item: ChecklistItem = { id: `chk-${Date.now().toString(36)}`, label: label.trim() || "New item", status: "Pending" };
      clients = clients.map((c) => (c.id === clientId ? { ...c, checklist: [...(c.checklist?.length ? c.checklist : defaultChecklist()), item] } : c));
      notify();
      return item.id;
    },
    updateChecklistItem: (clientId: string, itemId: string, data: Partial<ChecklistItem>) => {
      clients = clients.map((c) => {
        if (c.id !== clientId) return c;
        const base = c.checklist?.length ? c.checklist : defaultChecklist();
        return { ...c, checklist: base.map((i) => (i.id === itemId ? { ...i, ...data } : i)) };
      });
      notify();
    },
    deleteChecklistItem: (clientId: string, itemId: string) => {
      clients = clients.map((c) => {
        if (c.id !== clientId) return c;
        const base = c.checklist?.length ? c.checklist : defaultChecklist();
        return { ...c, checklist: base.filter((i) => i.id !== itemId) };
      });
      notify();
    },
    setChecklistArchived: (clientId: string, archived: boolean) => {
      clients = clients.map((c) => (c.id === clientId ? { ...c, checklistArchived: archived } : c));
      notify();
    },

    // Agent CRUD
    addAgent: (data: Omit<Agent, "id">) => {
      const id = generateId("AV-A", nextAgentNum++);
      agents = [...agents, { ...data, id }];
      notify();
      return id;
    },
    updateAgent: (id: string, data: Partial<Agent>) => {
      agents = agents.map((a) => (a.id === id ? { ...a, ...data } : a));
      notify();
    },
    deleteAgent: (id: string) => {
      agents = agents.filter((a) => a.id !== id);
      notify();
    },

    // Supplier CRUD
    addSupplier: (data: Omit<Supplier, "id">) => {
      const id = generateId("AV-S", nextSupplierNum++);
      suppliers = [...suppliers, { ...data, id }];
      notify();
      return id;
    },
    updateSupplier: (id: string, data: Partial<Supplier>) => {
      suppliers = suppliers.map((s) => (s.id === id ? { ...s, ...data } : s));
      notify();
    },
    deleteSupplier: (id: string) => {
      suppliers = suppliers.filter((s) => s.id !== id);
      notify();
    },

    // Booking CRUD
    addBooking: (data: Omit<Booking, "id">) => {
      const id = `B${String(nextBookingNum++).padStart(3, "0")}`;
      bookings = [...bookings, { ...data, id, baseAmount: data.totalAmount, extraCharges: 0 }];
      resyncDerived();
      notify();
      return id;
    },
    updateBooking: (id: string, data: Partial<Booking>) => {
      const before = bookings.find((b) => b.id === id);
      bookings = bookings.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...data };
        if (data.totalAmount !== undefined) {
          next.baseAmount = data.totalAmount;
          next.totalAmount = data.totalAmount + (b.extraCharges || 0);
        }
        return next;
      });
      const after = bookings.find((b) => b.id === id);
      // Auto-sync deltas to agent / supplier when totals change
      if (before && after) {
        // ---- Sync clients when totalAmount or amountReceived changes ----
        const headClients = clients.filter((c) => c.headId === after.headId);
        const totalChanged = (before.totalAmount || 0) !== (after.totalAmount || 0);
        const receivedChanged = (before.amountReceived || 0) !== (after.amountReceived || 0);
        if ((totalChanged || receivedChanged) && headClients.length > 0) {
          const perPerson = Math.round((after.totalAmount || 0) / headClients.length);
          let remaining = after.amountReceived || 0;
          clients = clients.map((c) => {
            if (c.headId !== after.headId) return c;
            const due = totalChanged ? perPerson : c.amountDue;
            if (remaining <= 0) return { ...c, amountDue: due, amountPaid: 0, paymentStatus: "Unpaid" as const };
            if (remaining >= due) { remaining -= due; return { ...c, amountDue: due, amountPaid: due, paymentStatus: "Paid" as const }; }
            const paid = remaining; remaining = 0;
            return { ...c, amountDue: due, amountPaid: paid, paymentStatus: "Partial" as const };
          });
          // Sync a client_receive ledger entry so totals reconcile
          if (receivedChanged) {
            const existingReceived = entries.filter((e) => e.type === "client_receive" && e.headId === after.headId).reduce((s, e) => s + e.amount, 0);
            const delta = (after.amountReceived || 0) - existingReceived;
            if (delta !== 0) {
              const eid = `E${String(nextEntryNum++).padStart(3, "0")}`;
              entries = [...entries, {
                id: eid, date: getPKTDate(), type: "client_receive", headId: after.headId,
                referenceId: after.headId, referenceName: `Booking ${after.headId}`,
                amount: delta, note: `Adjustment from booking edit`,
                createdAt: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
              }];
            }
          }
        }
      }
      // Agents & suppliers are fully derived from bookings + ledger
      resyncDerived();
      notify();
    },
    deleteBooking: (id: string) => {
      const b = bookings.find((x) => x.id === id);
      if (!b) { notify(); return; }
      // Cascade: delete clients under this head + related ledger entries
      const headId = b.headId;
      clients = clients.filter((c) => c.headId !== headId);
      entries = entries.filter((e) => e.headId !== headId);
      bookings = bookings.filter((x) => x.id !== id);
      resyncDerived();
      notify();
    },

    // Entries CRUD
    addEntry: (data: Omit<LedgerEntry, "id" | "createdAt">) => {
      const id = `E${String(nextEntryNum++).padStart(3, "0")}`;
      const entry = { ...data, id, createdAt: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) };
      entries = [...entries, entry];
      resyncFromEntries({
        supplierIds: (data.type === "purchase" || data.type === "supplier_payment" || data.type === "supplier_refund") ? [data.referenceId] : [],
        agentIds: data.type === "agent_commission" ? [data.referenceId] : [],
        headIds: (data.type === "client_receive" || data.type === "client_charge" || data.type === "client_refund") && data.headId ? [data.headId] : [],
      });
      notify();
      return id;
    },
    updateEntry: (id: string, data: Partial<LedgerEntry>) => {
      const before = entries.find((e) => e.id === id);
      entries = entries.map((e) => (e.id === id ? { ...e, ...data } : e));
      const after = entries.find((e) => e.id === id);
      // Collect every ref possibly affected (old + new — reference or type may have changed)
      const supplierIds = new Set<string>();
      const agentIds = new Set<string>();
      const headIds = new Set<string>();
      [before, after].forEach((e) => {
        if (!e) return;
        if (e.type === "purchase" || e.type === "supplier_payment" || e.type === "supplier_refund") { if (e.referenceId) supplierIds.add(e.referenceId); }
        if (e.type === "agent_commission") { if (e.referenceId) agentIds.add(e.referenceId); }
        if (e.type === "client_receive" || e.type === "client_charge" || e.type === "client_refund") { if (e.headId) headIds.add(e.headId); }
      });
      resyncFromEntries({ supplierIds: [...supplierIds], agentIds: [...agentIds], headIds: [...headIds] });
      notify();
    },
    deleteEntry: (id: string) => {
      const e = entries.find((x) => x.id === id);
      entries = entries.filter((x) => x.id !== id);
      if (e) {
        resyncFromEntries({
          supplierIds: (e.type === "purchase" || e.type === "supplier_payment" || e.type === "supplier_refund") && e.referenceId ? [e.referenceId] : [],
          agentIds: e.type === "agent_commission" && e.referenceId ? [e.referenceId] : [],
          headIds: (e.type === "client_receive" || e.type === "client_charge" || e.type === "client_refund") && e.headId ? [e.headId] : [],
        });
      }
      notify();
    },

    generateHeadId: () => {
      const id = `AV-HD-${String(nextHeadNum++).padStart(3, "0")}`;
      return id;
    },

    // Booking services (hotels / flights / transports)
    addHotel: (bookingId: string, data: Omit<HotelService, "id">) => {
      const id = `H${Date.now().toString(36)}`;
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, hotels: [...(b.hotels || []), { ...data, id }] } : b);
      notify();
      return id;
    },
    deleteHotel: (bookingId: string, hotelId: string) => {
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, hotels: (b.hotels || []).filter((h) => h.id !== hotelId) } : b);
      notify();
    },
    addFlight: (bookingId: string, data: Omit<FlightService, "id">) => {
      const id = `F${Date.now().toString(36)}`;
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, flights: [...(b.flights || []), { ...data, id }] } : b);
      notify();
      return id;
    },
    deleteFlight: (bookingId: string, flightId: string) => {
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, flights: (b.flights || []).filter((f) => f.id !== flightId) } : b);
      notify();
    },
    addTransport: (bookingId: string, data: Omit<TransportService, "id">) => {
      const id = `T${Date.now().toString(36)}`;
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, transports: [...(b.transports || []), { ...data, id }] } : b);
      notify();
      return id;
    },
    deleteTransport: (bookingId: string, transportId: string) => {
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, transports: (b.transports || []).filter((t) => t.id !== transportId) } : b);
      notify();
    },
    addVisa: (bookingId: string, data: Omit<VisaService, "id">) => {
      const id = `V${Date.now().toString(36)}`;
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, visas: [...(b.visas || []), { ...data, id }] } : b);
      notify();
      return id;
    },
    deleteVisa: (bookingId: string, visaId: string) => {
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, visas: (b.visas || []).filter((v) => v.id !== visaId) } : b);
      notify();
    },
    addOther: (bookingId: string, data: Omit<OtherService, "id">) => {
      const id = `O${Date.now().toString(36)}`;
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, others: [...(b.others || []), { ...data, id }] } : b);
      notify();
      return id;
    },
    deleteOther: (bookingId: string, otherId: string) => {
      bookings = bookings.map((b) => b.id === bookingId ? { ...b, others: (b.others || []).filter((o) => o.id !== otherId) } : b);
      notify();
    },

    // Opening balances (dashboard baseline)
    setOpeningBalances: (data: Partial<OpeningBalances>) => {
      opening = { ...opening, ...data };
      notify();
    },

    // Wipe everything to a true blank slate (keeps opening balances editable in settings)
    resetAllData: (opts?: { keepOpening?: boolean }) => {
      clients = [];
      bookings = [];
      agents = [];
      suppliers = [];
      entries = [];
      monthlyData = [];
      groups = [];
      readAlerts = [];
      if (!opts?.keepOpening) opening = { ...defaultOpening };
      nextClientNum = 1; nextAgentNum = 1; nextSupplierNum = 1;
      nextBookingNum = 1; nextHeadNum = 1; nextEntryNum = 1; nextGroupNum = 1;
      notify();
    },
  };
}
