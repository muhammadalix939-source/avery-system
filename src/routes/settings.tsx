import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Save, Settings as SettingsIcon, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/data";
import { toast } from "sonner";
import BackupPanel from "@/components/BackupPanel";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Avery Group of Travel" }] }),
});

function SettingsPage() {
  const store = useStore();
  const [form, setForm] = useState({
    revenue: String(store.opening.revenue || 0),
    pending: String(store.opening.pending || 0),
    bookings: String(store.opening.bookings || 0),
    clients: String(store.opening.clients || 0),
    supplierDue: String(store.opening.supplierDue || 0),
    profit: String(store.opening.profit || 0),
    cost: String(store.opening.cost || 0),
    expenses: String(store.opening.expenses || 0),
    commission: String(store.opening.commission || 0),
    cash: String(store.opening.cash || 0),
    note: store.opening.note || "",
  });

  function save() {
    store.setOpeningBalances({
      revenue: Number(form.revenue) || 0,
      pending: Number(form.pending) || 0,
      bookings: Number(form.bookings) || 0,
      clients: Number(form.clients) || 0,
      supplierDue: Number(form.supplierDue) || 0,
      profit: Number(form.profit) || 0,
      cost: Number(form.cost) || 0,
      expenses: Number(form.expenses) || 0,
      commission: Number(form.commission) || 0,
      cash: Number(form.cash) || 0,
      note: form.note,
    });
    toast.success("Opening balances saved");
  }

  function reset() {
    setForm({ revenue: "0", pending: "0", bookings: "0", clients: "0", supplierDue: "0", profit: "0", cost: "0", expenses: "0", commission: "0", cash: "0", note: "" });
  }

  function wipeAll(keepOpening: boolean) {
    const msg = keepOpening
      ? "This will permanently delete all clients, bookings, agents, suppliers, entries and monthly history. Opening balances will be kept. Continue?"
      : "This will permanently delete EVERYTHING (including opening balances) and reset the system to a true blank slate. Continue?";
    if (!confirm(msg)) return;
    store.resetAllData({ keepOpening });
    if (!keepOpening) setForm({ revenue: "0", pending: "0", bookings: "0", clients: "0", supplierDue: "0", profit: "0", cost: "0", expenses: "0", commission: "0", cash: "0", note: "" });
    toast.success(keepOpening ? "All operational data cleared." : "System fully reset to blank slate.");
  }

  const fields: Array<[keyof typeof form, string, string]> = [
    ["revenue", "Opening Revenue (PKR)", "Cash already collected before this system"],
    ["cost", "Opening Cost of Sales (PKR)", "Supplier cost of those old sales — must be filled if Opening Revenue is filled, otherwise profit inflates"],
    ["expenses", "Opening Expenses (PKR)", "Office / operating expenses already incurred"],
    ["commission", "Opening Agent Commission (PKR)", "Commission already earned by agents on old sales"],
    ["cash", "Opening Cash / Bank (PKR)", "Actual money in hand + bank when you started using this system"],
    ["pending", "Opening Pending (PKR)", "Outstanding receivables from old bookings"],
    ["bookings", "Opening Bookings (count)", "Historical booking count"],
    ["clients", "Opening Clients (count)", "Historical client count"],
    ["supplierDue", "Opening Supplier Due (PKR)", "What you still owe legacy suppliers"],
    ["profit", "Profit Adjustment (PKR)", "Manual correction only — leave 0 if you filled Opening Revenue/Cost/Expenses above"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Edit dashboard opening balances and business defaults" />
      <BackupPanel />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Dashboard Opening Balances</h2>
            <p className="text-xs text-muted-foreground">
              These values are added on top of your live data so the dashboard reflects your full business
              history (including records that aren't entered into the system yet).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map(([key, label, hint]) => (
            <div key={key}>
              <Label className="text-xs font-semibold">{label}</Label>
              <Input
                type="number"
                value={form[key] as string}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="bg-accent/20 border-border mt-1 h-9 text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs font-semibold">Notes (optional)</Label>
          <Textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="bg-accent/20 border-border mt-1 text-sm"
            placeholder="Any internal notes about how these baseline numbers were calculated…"
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save Opening Balances</Button>
          <Button onClick={reset} variant="outline">Reset to zero</Button>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-2">Live Preview</p>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <Stat label="Revenue baseline" value={formatCurrency(Number(form.revenue) || 0)} />
            <Stat label="Cost baseline" value={formatCurrency(Number(form.cost) || 0)} />
            <Stat label="Expenses baseline" value={formatCurrency(Number(form.expenses) || 0)} />
            <Stat label="Commission baseline" value={formatCurrency(Number(form.commission) || 0)} />
            <Stat label="Cash baseline" value={formatCurrency(Number(form.cash) || 0)} />
            <Stat
              label="Opening gross profit"
              value={formatCurrency((Number(form.revenue) || 0) - (Number(form.cost) || 0) - (Number(form.expenses) || 0) - (Number(form.commission) || 0))}
            />
            <Stat label="Pending baseline" value={formatCurrency(Number(form.pending) || 0)} />
            <Stat label="Bookings baseline" value={String(Number(form.bookings) || 0)} />
            <Stat label="Clients baseline" value={String(Number(form.clients) || 0)} />
            <Stat label="Supplier due baseline" value={formatCurrency(Number(form.supplierDue) || 0)} />
            <Stat label="Profit adjustment" value={formatCurrency(Number(form.profit) || 0)} />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-2">Per-entity opening balances</h3>
        <p className="text-xs text-muted-foreground">
          Opening balances for individual <span className="text-primary font-medium">agents</span>,
          <span className="text-primary font-medium"> suppliers</span> and
          <span className="text-primary font-medium"> clients</span> are set inside each record's edit form
          (Previous Commission, Previous Payable, etc). These flow into their statements automatically.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-xl p-6 border-destructive/40">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground">Use these only when starting fresh. Mock / sample data lingering in the system can be wiped here.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => wipeAll(true)} variant="outline" className="gap-2 border-warning/40 text-warning hover:bg-warning/10">
            <Trash2 className="h-4 w-4" /> Clear all operational data (keep opening balances)
          </Button>
          <Button onClick={() => wipeAll(false)} variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" /> Wipe everything (full reset)
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/50 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}