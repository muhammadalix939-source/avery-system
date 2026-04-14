import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Phone, Trash2, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DetailDialog from "@/components/DetailDialog";
import { formatCurrency, type Client } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useState } from "react";

export const Route = createFileRoute("/clients")({
  component: ClientsPage,
  head: () => ({ meta: [{ title: "Clients — AV Travel CRM" }] }),
});

function ClientsPage() {
  const store = useStore();
  const [filter, setFilter] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [form, setForm] = useState({ headId: "", name: "", passport: "", phone: "", packageType: "Umrah" as Client["packageType"], amountDue: "", isVip: false });

  const filtered = filter === "All" ? store.clients : store.clients.filter((c) => c.paymentStatus === filter);

  function handleAdd() {
    store.addClient({
      headId: form.headId,
      name: form.name,
      passport: form.passport,
      phone: form.phone,
      packageType: form.packageType,
      paymentStatus: "Unpaid",
      amountDue: Number(form.amountDue) || 0,
      amountPaid: 0,
      isVip: form.isVip,
    });
    setForm({ headId: "", name: "", passport: "", phone: "", packageType: "Umrah", amountDue: "", isVip: false });
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateClient(selected.id, {
      headId: form.headId,
      name: form.name,
      passport: form.passport,
      phone: form.phone,
      packageType: form.packageType,
      amountDue: Number(form.amountDue) || 0,
      isVip: form.isVip,
    });
    setEditOpen(false);
  }

  function openEdit(c: Client) {
    setSelected(c);
    setForm({ headId: c.headId, name: c.name, passport: c.passport, phone: c.phone, packageType: c.packageType, amountDue: String(c.amountDue), isVip: c.isVip });
    setEditOpen(true);
  }

  const relatedEntries = selected ? store.entries.filter((e) => e.referenceId === selected.id) : [];

  const formFields = (
    <div className="space-y-4">
      <div><Label>Head ID</Label><Input value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })} placeholder="AV-HD-001" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Passport</Label><Input value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} placeholder="AB1234567" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03001234567" className="bg-accent/20 border-border mt-1" /></div>
      <div><Label>Package Type</Label>
        <Select value={form.packageType} onValueChange={(v) => setForm({ ...form, packageType: v as Client["packageType"] })}>
          <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Umrah">Umrah</SelectItem><SelectItem value="Hajj">Hajj</SelectItem><SelectItem value="Tour">Tour</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Amount Due (PKR)</Label><Input type="number" value={form.amountDue} onChange={(e) => setForm({ ...form, amountDue: e.target.value })} placeholder="100000" className="bg-accent/20 border-border mt-1" /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.isVip} onChange={(e) => setForm({ ...form, isVip: e.target.checked })} className="rounded" />
        <Label>VIP Client</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Management"
        subtitle={`${store.clients.length} total clients`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ headId: "", name: "", passport: "", phone: "", packageType: "Umrah", amountDue: "", isVip: false })}>
                <Plus className="h-4 w-4" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Add Client</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap gap-2">
        {["All", "Paid", "Partial", "Unpaid"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}>{f}</button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Client ID</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Head ID</th>
                <th className="px-4 py-3">Phone</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-semibold text-primary">{c.id}</td>
                  <td className="px-4 py-3 font-medium">{c.name} {c.isVip && "⭐"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.headId}</td>
                  <td className="px-4 py-3 text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span></td>
                  <td className="px-4 py-3">{c.packageType}</td>
                  <td className="px-4 py-3 text-success">{formatCurrency(c.amountPaid)}</td>
                  <td className="px-4 py-3 text-destructive">{formatCurrency(c.amountDue - c.amountPaid)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.paymentStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(c); setDetailOpen(true); }} className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                      <button onClick={() => openEdit(c)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                      <button onClick={() => store.deleteClient(c.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Client — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} type="client" data={selected} entries={relatedEntries} />
    </div>
  );
}
