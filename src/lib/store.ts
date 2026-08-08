// Centralized state management for the CRM
import { useState, useCallback, useEffect } from "react";
import type { Client, Booking, Agent, Supplier, HotelService, FlightService, TransportService, VisaService, OtherService } from "./data";
import { mockClients, mockBookings, mockAgents, mockSuppliers, mockMonthlyData as defaultMonthlyData, generateId } from "./data";
import { getPKTDate } from "./date-utils";

export interface LedgerEntry {
  id: string;
  date: string;
  type:
    | "client_receive"
    | "supplier_payment"
    | "agent_commission"
    | "expense"
    | "purchase"
    | "client_charge"
    | "client_refund"
    | "supplier_refund";
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
        clients, bookings, agents, suppliers, monthlyData, entries, opening, groups,
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
    if (s.counters) {
      nextClientNum = s.counters.client; nextAgentNum = s.counters.agent;
      nextSupplierNum = s.counters.supplier; nextBookingNum = s.counters.booking;
      nextHeadNum = s.counters.head; nextEntryNum = s.counters.entry;
      nextGroupNum = s.counters.group || nextGroupNum;
    }
  } catch {}
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
// Recompute derived totals on suppliers / agents / bookings from the entries array.
// Call after ANY entry add / update / delete so views and PDFs stay consistent.
function resyncFromEntries(refIds: { supplierIds?: string[]; agentIds?: string[]; headIds?: string[] }) {
  const supplierIds = new Set(refIds.supplierIds || []);
  const agentIds = new Set(refIds.agentIds || []);
  const headIds = new Set(refIds.headIds || []);

  // Suppliers: totalPayable = purchases − supplier refunds, totalPaid = supplier payments
  if (supplierIds.size) {
    suppliers = suppliers.map((s) => {
      if (!supplierIds.has(s.id)) return s;
      const purchases = entries.filter((e) => e.type === "purchase" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
      const refunds  = entries.filter((e) => e.type === "supplier_refund" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
      const payments  = entries.filter((e) => e.type === "supplier_payment" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
      // Also honour any legacy totalCost coming from bookings for this supplier
      const bookingCost = bookings.filter((b) => b.supplierId === s.id).reduce((sum, b) => sum + (b.totalCost || 0), 0);
      return { ...s, totalPayable: Math.max(0, Math.max(purchases, bookingCost) - refunds), totalPaid: payments };
    });
  }

  // Agents: paidCommission = sum(agent_commission entries)
  if (agentIds.size) {
    agents = agents.map((a) => {
      if (!agentIds.has(a.id)) return a;
      const paid = entries.filter((e) => e.type === "agent_commission" && e.referenceId === a.id).reduce((sum, e) => sum + e.amount, 0);
      return { ...a, paidCommission: paid };
    });
  }

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
        // Agent commission / sales delta
        if (after.agentId && after.agentId !== "Direct") {
          const agent = agents.find((a) => a.id === after.agentId);
          if (agent) {
            const dSales = (after.totalAmount || 0) - (before.totalAmount || 0);
            const dComm  = (after.commission  || 0) - (before.commission  || 0);
            if (dSales || dComm) {
              agents = agents.map((a) => a.id === agent.id ? {
                ...a,
                totalSales: Math.max(0, a.totalSales + dSales),
                commission: Math.max(0, a.commission + dComm),
              } : a);
            }
          }
        }
        // Supplier payable delta
        if (after.supplierId) {
          const sup = suppliers.find((s) => s.id === after.supplierId);
          if (sup) {
            const dCost = (after.totalCost || 0) - (before.totalCost || 0);
            if (dCost) {
              suppliers = suppliers.map((s) => s.id === sup.id ? {
                ...s, totalPayable: Math.max(0, s.totalPayable + dCost),
              } : s);
            }
          }
        }
      }
      notify();
    },
    deleteBooking: (id: string) => {
      const b = bookings.find((x) => x.id === id);
      if (!b) { notify(); return; }
      // Reverse agent stats
      if (b.agentId && b.agentId !== "Direct") {
        const agent = agents.find((a) => a.id === b.agentId);
        if (agent) {
          agents = agents.map((a) => a.id === agent.id ? {
            ...a,
            totalSales:    Math.max(0, a.totalSales    - (b.totalAmount || 0)),
            totalClients:  Math.max(0, a.totalClients  - (b.clientIds.length || 0)),
            commission:    Math.max(0, a.commission    - (b.commission  || 0)),
          } : a);
        }
      }
      // Reverse supplier payable
      if (b.supplierId) {
        const sup = suppliers.find((s) => s.id === b.supplierId);
        if (sup) {
          suppliers = suppliers.map((s) => s.id === sup.id ? {
            ...s, totalPayable: Math.max(0, s.totalPayable - (b.totalCost || 0)),
          } : s);
        }
      }
      // Cascade: delete clients under this head + related ledger entries
      const headId = b.headId;
      clients = clients.filter((c) => c.headId !== headId);
      entries = entries.filter((e) => e.headId !== headId);
      bookings = bookings.filter((x) => x.id !== id);
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
      if (!opts?.keepOpening) opening = { ...defaultOpening };
      nextClientNum = 1; nextAgentNum = 1; nextSupplierNum = 1;
      nextBookingNum = 1; nextHeadNum = 1; nextEntryNum = 1; nextGroupNum = 1;
      notify();
    },
  };
}
