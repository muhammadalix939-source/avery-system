import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/lib/data";
import { useStore, type LedgerEntry } from "@/lib/store";
import { getPKTDate } from "@/lib/date-utils";
import { useState } from "react";

export const Route = createFileRoute("/entries")({
  component: EntriesPage,
  head: () => ({ meta: [{ title: "Entries — AV Travel CRM" }] }),
});

const typeLabels: Record<LedgerEntry["type"], string> = {
  client_receive: "Client Payment Received",
  supplier_payment: "Supplier Payment",
  agent_commission: "Agent Commission",
  expense: "Expense",
};

const typeColors: Record<LedgerEntry["type"], string> = {
  client_receive: "text-success",
  supplier_payment: "text-destructive",
  agent_commission: "text-warning",
  expense: "text-destructive",
};

function EntriesPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState({ date: "", type: "client_receive" as LedgerEntry["type"], headId: "", referenceId: "", referenceName: "", amount: "", note: "" });

  const sorted = [...store.entries].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = typeFilter === "all" ? sorted : sorted.filter((e) => e.type === typeFilter);

  function handleAdd() {
    store.addEntry({ date: form.date || getPKTDate(), type: form.type, headId: form.headId, referenceId: form.referenceId, referenceName: form.referenceName, amount: Number(form.amount) || 0, note: form.note });
    setForm({ date: "", type: "client_receive", headId: "", referenceId: "", referenceName: "", amount: "", note: "" });
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateEntry(selected.id, { date: form.date, type: form.type, headId: form.headId, referenceId: form.referenceId, referenceName: form.referenceName, amount: Number(form.amount) || 0, note: form.note });
    setEditOpen(false);
  }

  function openEdit(e: LedgerEntry) {
    setSelected(e);
    setForm({ date: e.date, type: e.type, headId: e.headId, referenceId: e.referenceId, referenceName: e.referenceName, amount: String(e.amount), note: e.note });
    setEditOpen(true);
  }

  const totalReceived = store.entries.filter((e) => e.type === "client_receive").reduce((s, e) => s + e.amount, 0);
  const totalPaid = store.entries.filter((e) => e.type === "supplier_payment" || e.type === "agent_commission" || e.type === "expense").reduce((s, e) => s + e.amount, 0);

  // Auto-populate reference name when type or referenceId changes
  function updateFormType(type: LedgerEntry["type"]) {
    setForm({ ...form, type, referenceId: "", referenceName: "", headId: "" });
  }

  function updateReferenceId(refId: string) {
    let name = "";
    if (form.type === "client_receive") {
      const booking = store.bookings.find((b) => b.headId === refId);
      if (booking) {
        const headClient = store.clients.find((c) => c.headId === refId);
        name = headClient ? getClientName(headClient) : refId;
      }
      setForm({ ...form, referenceId: refId, referenceName: name || form.referenceName, headId: refId });
    } else if (form.type === "supplier_payment") {
      const supplier = store.suppliers.find((s) => s.id === refId);
      name = supplier?.companyName || "";
      setForm({ ...form, referenceId: refId, referenceName: name || form.referenceName });
    } else if (form.type === "agent_commission") {
      const agent = store.agents.find((a) => a.id === refId);
      name = agent?.name || "";
      setForm({ ...form, referenceId: refId, referenceName: name || form.referenceName });
    } else {
      setForm({ ...form, referenceId: refId });
    }
  }

  const formFields = (
    <div className="space-y-4">
      <div><Label>Entry Type</Label>
        <Select value={form.type} onValueChange={(v) => updateFormType(v as LedgerEntry["type"])}>
          <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="client_receive">Client Payment Received</SelectItem>
            <SelectItem value="supplier_payment">Supplier Payment</SelectItem>
            <SelectItem value="agent_commission">Agent Commission</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-accent/20 border-border mt-1" /></div>

      {form.type === "client_receive" && (
        <div><Label>Head ID</Label>
          <Select value={form.headId} onValueChange={(v) => updateReferenceId(v)}>
            <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue placeholder="Select Head ID" /></SelectTrigger>
            <SelectContent>
              {store.bookings.map((b) => <SelectItem key={b.headId} value={b.headId}>{b.headId} — {b.packageType}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.type === "supplier_payment" && (
        <div><Label>Supplier</Label>
          <Select value={form.referenceId} onValueChange={(v) => updateReferenceId(v)}>
            <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue placeholder="Select Supplier" /></SelectTrigger>
            <SelectContent>
              {store.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.id} — {s.companyName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.type === "agent_commission" && (
        <div><Label>Agent</Label>
          <Select value={form.referenceId} onValueChange={(v) => updateReferenceId(v)}>
            <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue placeholder="Select Agent" /></SelectTrigger>
            <SelectContent>
              {store.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} — {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.type === "expense" && (
        <div><Label>Expense Name</Label><Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })} placeholder="Office Rent, Utilities..." className="bg-accent/20 border-border mt-1" /></div>
      )}

      <div><Label>Amount (PKR)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="100000" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Payment note..." className="bg-accent/20 border-border mt-1" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entries & Ledger"
        subtitle="All financial transactions"
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ date: getPKTDate(), type: "client_receive", headId: "", referenceId: "", referenceName: "", amount: "", note: "" })}>
                <Plus className="h-4 w-4" /> New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Add New Entry</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Submit Entry</Button>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Received</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Paid Out</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Net Balance</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalReceived - totalPaid)}</p>
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "client_receive", "supplier_payment", "agent_commission", "expense"] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}>
            {t === "all" ? "All" : typeLabels[t]}
          </button>
        ))}
      </div>

      {/* Entries Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Head ID</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Note</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-semibold text-primary">{e.id}</td>
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md bg-accent/30 px-2 py-1 text-[10px] font-semibold uppercase ${typeColors[e.type]}`}>
                      {typeLabels[e.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.headId || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{e.referenceName}</p>
                    <p className="text-xs text-muted-foreground">{e.referenceId}</p>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${e.type === "client_receive" ? "text-success" : "text-destructive"}`}>
                    {e.type === "client_receive" ? "+" : "-"}{formatCurrency(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{e.note}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(e)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                      <button onClick={() => store.deleteEntry(e.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Entry — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
