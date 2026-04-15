import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DetailDialog from "@/components/DetailDialog";
import { formatCurrency, type Agent } from "@/lib/data";
import { useStore } from "@/lib/store";
import { generateAgentReport } from "@/lib/pdf";
import { useState } from "react";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
  head: () => ({ meta: [{ title: "Agents — AV Travel CRM" }] }),
});

function AgentsPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", status: "Active" as Agent["status"] });

  function handleAdd() {
    store.addAgent({ name: form.name, phone: form.phone, email: form.email, totalSales: 0, totalClients: 0, commission: 0, status: form.status });
    setForm({ name: "", phone: "", email: "", status: "Active" });
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateAgent(selected.id, { name: form.name, phone: form.phone, email: form.email, status: form.status });
    setEditOpen(false);
  }

  function openEdit(a: Agent) {
    setSelected(a);
    setForm({ name: a.name, phone: a.phone, email: a.email, status: a.status });
    setEditOpen(true);
  }

  function downloadReport(a: Agent) {
    const entries = store.entries.filter((e) => e.referenceId === a.id);
    generateAgentReport(a, entries);
  }

  const relatedEntries = selected ? store.entries.filter((e) => e.referenceId === selected.id) : [];

  const formFields = (
    <div className="space-y-3">
      <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Status</Label>
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Agent["status"] })}>
          <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Management"
        subtitle={`${store.agents.length} agents`}
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => setForm({ name: "", phone: "", email: "", status: "Active" })}>
                <Plus className="h-4 w-4" /> Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Add Agent</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {store.agents.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card glass-card-hover rounded-xl p-5 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {a.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <button onClick={() => { setSelected(a); setDetailOpen(true); }} className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></button>
                <button onClick={() => downloadReport(a)} className="rounded p-1 hover:bg-accent" title="Download Report"><Download className="h-3.5 w-3.5 text-success" /></button>
                <button onClick={() => openEdit(a)} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-warning" /></button>
                <button onClick={() => store.deleteAgent(a.id)} className="rounded p-1 hover:bg-accent"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>
            <h3 className="text-lg font-semibold">{a.name}</h3>
            <p className="text-xs text-muted-foreground">{a.id} · {a.email}</p>
            <p className="text-xs text-muted-foreground">{a.phone}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-4">
              <div><p className="text-[10px] uppercase text-muted-foreground">Sales</p><p className="text-sm font-semibold text-primary">{formatCurrency(a.totalSales)}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Clients</p><p className="text-sm font-semibold">{a.totalClients}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Commission</p><p className="text-sm font-semibold text-success">{formatCurrency(a.commission)}</p></div>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Edit Agent — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>

      <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} type="agent" data={selected} entries={relatedEntries} />
    </div>
  );
}
