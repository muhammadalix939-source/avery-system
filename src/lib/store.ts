// Centralized state management for the CRM
import { useState, useCallback, useEffect } from "react";
import type { Client, Booking, Agent, Supplier, HotelService, FlightService, TransportService, VisaService, OtherService } from "./data";
import { mockClients, mockBookings, mockAgents, mockSuppliers, mockMonthlyData as defaultMonthlyData, generateId } from "./data";
import { getPKTDate } from "./date-utils";

export interface LedgerEntry {
  id: string;
  date: string;
  type: "client_receive" | "supplier_payment" | "agent_commission" | "expense";
  headId: string;
  referenceId: string; // client/supplier/agent ID
  referenceName: string;
  amount: number;
  note: string;
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
  note?: string;
}

const defaultOpening: OpeningBalances = {
  revenue: 0, pending: 0, bookings: 0, clients: 0, supplierDue: 0, profit: 0,
};

interface PersistedState {
  clients: Client[];
  bookings: Booking[];
  agents: Agent[];
  suppliers: Supplier[];
  monthlyData: typeof defaultMonthlyData;
  entries: LedgerEntry[];
  counters: { client: number; agent: number; supplier: number; booking: number; head: number; entry: number };
  opening?: OpeningBalances;
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
  if (typeof window === "undefined") {
    return {
      clients: [...mockClients], bookings: [...mockBookings], agents: [...mockAgents],
      suppliers: [...mockSuppliers], monthlyData: [...defaultMonthlyData], entries: defaultEntries,
      counters: { client: 11, agent: 4, supplier: 5, booking: 4, head: 4, entry: 7 },
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {}
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
let nextClientNum = initial.counters.client;
let nextAgentNum = initial.counters.agent;
let nextSupplierNum = initial.counters.supplier;
let nextBookingNum = initial.counters.booking;
let nextHeadNum = initial.counters.head;
let nextEntryNum = initial.counters.entry;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clients, bookings, agents, suppliers, monthlyData, entries, opening,
        counters: { client: nextClientNum, agent: nextAgentNum, supplier: nextSupplierNum, booking: nextBookingNum, head: nextHeadNum, entry: nextEntryNum },
      }));
    } catch {}
  }, 150);
}

const listeners = new Set<() => void>();
function notify() { persist(); listeners.forEach((l) => l()); }

export function useStore() {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    listeners.add(rerender);
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

    // Client CRUD
    addClient: (data: Omit<Client, "id">) => {
      const id = generateId("AV-C", nextClientNum++);
      clients = [...clients, { ...data, id }];
      notify();
      return id;
    },
    updateClient: (id: string, data: Partial<Client>) => {
      clients = clients.map((c) => (c.id === id ? { ...c, ...data } : c));
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
      bookings = [...bookings, { ...data, id }];
      notify();
      return id;
    },
    updateBooking: (id: string, data: Partial<Booking>) => {
      const before = bookings.find((b) => b.id === id);
      bookings = bookings.map((b) => (b.id === id ? { ...b, ...data } : b));
      const after = bookings.find((b) => b.id === id);
      // Auto-sync deltas to agent / supplier when totals change
      if (before && after) {
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

      // Auto-sync: update related records based on entry type
      if (data.type === "client_receive" && data.headId) {
        // Update booking amountReceived
        const booking = bookings.find((b) => b.headId === data.headId);
        if (booking) {
          const totalReceived = entries.filter((e) => e.type === "client_receive" && e.headId === data.headId).reduce((s, e) => s + e.amount, 0);
          bookings = bookings.map((b) => b.headId === data.headId ? { ...b, amountReceived: totalReceived } : b);
          // Distribute payment to clients under this head
          const headClients = clients.filter((c) => c.headId === data.headId);
          let remaining = totalReceived;
          clients = clients.map((c) => {
            if (c.headId !== data.headId) return c;
            if (remaining <= 0) return { ...c, amountPaid: 0, paymentStatus: "Unpaid" as const };
            if (remaining >= c.amountDue) { remaining -= c.amountDue; return { ...c, amountPaid: c.amountDue, paymentStatus: "Paid" as const }; }
            const paid = remaining; remaining = 0;
            return { ...c, amountPaid: paid, paymentStatus: "Partial" as const };
          });
        }
      }

      if (data.type === "supplier_payment" && data.referenceId) {
        // Update supplier totalPaid
        const totalPaid = entries.filter((e) => e.type === "supplier_payment" && e.referenceId === data.referenceId).reduce((s, e) => s + e.amount, 0);
        suppliers = suppliers.map((s) => s.id === data.referenceId ? { ...s, totalPaid } : s);
      }

      if (data.type === "agent_commission" && data.referenceId) {
        // Update agent paidCommission
        const totalPaid = entries.filter((e) => e.type === "agent_commission" && e.referenceId === data.referenceId).reduce((s, e) => s + e.amount, 0);
        agents = agents.map((a) => a.id === data.referenceId ? { ...a, paidCommission: totalPaid } : a);
      }

      notify();
      return id;
    },
    updateEntry: (id: string, data: Partial<LedgerEntry>) => {
      entries = entries.map((e) => (e.id === id ? { ...e, ...data } : e));
      notify();
    },
    deleteEntry: (id: string) => {
      entries = entries.filter((e) => e.id !== id);
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
  };
}
