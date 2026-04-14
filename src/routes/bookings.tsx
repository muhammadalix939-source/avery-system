import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Eye, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, type Booking } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useState } from "react";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Bookings — AV Travel CRM" }] }),
});

function BookingsPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [form, setForm] = useState({ agentId: "", supplierId: "", totalAmount: "", amountReceived: "", packageType: "Umrah" as Booking["packageType"], status: "Pending" as Booking["status"], travelDate: "" });

  function handleAdd() {
    const headId = store.generateHeadId();
    store.addBooking({
      headId,
      agentId: form.agentId,
      supplierId: form.supplierId,
      totalAmount: Number(form.totalAmount) || 0,
      amountReceived: Number(form.amountReceived) || 0,
      clientIds: [],
      status: form.status,
      packageType: form.packageType,
      travelDate: form.travelDate,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setForm({ agentId: "", supplierId: "", totalAmount: "", amountReceived: "", packageType: "Umrah", status: "Pending", travelDate: "" });
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateBooking(selected.id, {
      agentId: form.agentId,
      supplierId: form.supplierId,
      totalAmount: Number(form.totalAmount) || 0,
      amountReceived: Number(form.amountReceived) || 0,
      packageType: form.packageType,
      status: form.status,
      travelDate: form.travelDate,
    });
    setEditOpen(false);
  }

  function openEdit(b: Booking) {
    setSelected(b);
    setForm({ agentId: b.agentId, supplierId: b.supplierId, totalAmount: String(b.totalAmount), amountReceived: String(b.amountReceived), packageType: b.packageType, status: b.status, travelDate: b.travelDate });
    setEditOpen(true);
  }

  const formFields = (
    <div className="space-y-4">
      <div><Label>Agent ID</Label><Input value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} placeholder="AV-A001" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Supplier ID</Label><Input value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} placeholder="AV-S001" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Package Type</Label>
        <Select value={form.packageType} onValueChange={(v) => setForm({ ...form, packageType: v as Booking["packageType"] })}>
          <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Umrah">Umrah</SelectItem><SelectItem value="Hajj">Hajj</SelectItem><SelectItem value="Tour">Tour</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Booking["status"] })}>
          <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Total Amount (PKR)</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Amount Received (PKR)</Label><Input type="number" value={form.amountReceived} onChange={(e) => setForm({ ...form, amountReceived: e.target.value })} className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Travel Date</Label><Input type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} className="bg-accent/20 border-border mt-1" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings (Head IDs)"
        subtitle="Master booking management"
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ agentId: "", supplierId: "", totalAmount: "", amountReceived: "", packageType: "Umrah", status: "Pending", travelDate: "" })}>
                <Plus className="h-4 w-4" /> New Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Create New Booking</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Create Booking</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Head ID</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Agent</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Pending</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Travel</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {store.bookings.map((b) => {
                const pending = b.totalAmount - b.amountReceived;
                const clients = store.clients.filter((c) => c.headId === b.headId);
                return (
                  <tr key={b.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3 font-semibold text-primary">{b.headId}</td>
                    <td className="px-4 py-3">{b.packageType}</td>
                    <td className="px-4 py-3">{clients.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.agentId}</td>
                    <td className="px-4 py-3">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-success">{formatCurrency(b.amountReceived)}</td>
                    <td className="px-4 py-3 text-destructive">{formatCurrency(pending)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{b.travelDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link to="/payments" className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></Link>
                        <button onClick={() => openEdit(b)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                        <button onClick={() => store.deleteBooking(b.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {store.bookings.map((b) => {
        const clients = store.clients.filter((c) => c.headId === b.headId);
        return (
          <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold"><span className="text-primary">{b.headId}</span> — Clients ({clients.length})</h3>
              <span className="text-xs text-muted-foreground">Supplier: {b.supplierId}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-accent/10 px-4 py-3">
                  <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.id} · {c.passport}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">{formatCurrency(c.amountPaid)} / {formatCurrency(c.amountDue)}</p><StatusBadge status={c.paymentStatus} /></div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Booking — {selected?.headId}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
