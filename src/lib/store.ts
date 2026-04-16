// Centralized state management for the CRM
import { useState, useCallback, useEffect } from "react";
import type { Client, Booking, Agent, Supplier } from "./data";
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

// Simple global store using module-level state + listeners
let clients = [...mockClients];
let bookings = [...mockBookings];
let agents = [...mockAgents];
let suppliers = [...mockSuppliers];
let monthlyData = [...defaultMonthlyData];
let entries: LedgerEntry[] = [
  { id: "E001", date: "2026-03-15", type: "client_receive", headId: "AV-HD-001", referenceId: "AV-C001", referenceName: "Muhammad Ali", amount: 100000, note: "Initial deposit", createdAt: "2026-03-15T10:00:00" },
  { id: "E002", date: "2026-03-20", type: "client_receive", headId: "AV-HD-001", referenceId: "AV-C002", referenceName: "Fatima Ali", amount: 100000, note: "Full payment", createdAt: "2026-03-20T14:30:00" },
  { id: "E003", date: "2026-03-25", type: "supplier_payment", headId: "", referenceId: "AV-S001", referenceName: "Al-Haram Hotels", amount: 200000, note: "Hotel advance", createdAt: "2026-03-25T11:00:00" },
  { id: "E004", date: "2026-04-01", type: "agent_commission", headId: "", referenceId: "AV-A001", referenceName: "Ahmed Khan", amount: 50000, note: "March commission", createdAt: "2026-04-01T09:00:00" },
  { id: "E005", date: "2026-04-05", type: "expense", headId: "", referenceId: "", referenceName: "Office Rent", amount: 30000, note: "Monthly office rent", createdAt: "2026-04-05T12:00:00" },
  { id: "E006", date: "2026-02-10", type: "client_receive", headId: "AV-HD-002", referenceId: "AV-C006", referenceName: "Zainab Raza", amount: 250000, note: "Full payment Hajj", createdAt: "2026-02-10T10:00:00" },
];

let nextClientNum = 11;
let nextAgentNum = 4;
let nextSupplierNum = 5;
let nextBookingNum = 4;
let nextHeadNum = 4;
let nextEntryNum = 7;

const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }

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
      bookings = bookings.map((b) => (b.id === id ? { ...b, ...data } : b));
      notify();
    },
    deleteBooking: (id: string) => {
      bookings = bookings.filter((b) => b.id !== id);
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
  };
}
