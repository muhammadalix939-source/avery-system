import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Wallet, Landmark, Banknote, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStore, computeAccountBalance, buildAccountLedger, type Account } from "@/lib/store";
import { formatCurrency } from "@/lib/data";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — Avery Travel CRM" },
      { name: "description", content: "Cash, bank and wallet accounts with live balances and running ledgers." },
      { property: "og:title", content: "Accounts — Avery Travel CRM" },
      { property: "og:description", content: "Cash, bank and wallet accounts with live balances and running ledgers." },
    ],
  }),
  component: AccountsPage,
});

const icons = { Cash: Banknote, Bank: Landmark, "Mobile Wallet": Wallet };
const empty = { name: "", type: "Bank" as Account["type"], number: "", branch: "", openingBalance: "", openingDate: new Date().toISOString().slice(0, 10) };

function AccountsPage() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [sel, setSel] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const selected = store.accounts.find((a) => a.id === sel) || store.accounts[0];
  const rows = selected ? buildAccountLedger(selected.id).filter((r) => (!from || r.date >= from) && (!to || r.date <= to)) : [];
  const total = store.accounts.reduce((s, a) => s + computeAccountBalance(a.id), 0);

  const save = () => {
    if (!f.name.trim()) return;
    store.addAccount({ ...f, openingBalance: Number(f.openingBalance) || 0 });
    setF(empty); setOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" subtitle={`Combined balance ${formatCurrency(total)}`} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Account</Button></DialogTrigger>
          <DialogContent className="border-border bg-card">
            <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Meezan Bank Main" /></div>
              <div><Label>Type</Label>
                <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as Account["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Cash", "Bank", "Mobile Wallet"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Account No.</Label><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div>
                <div><Label>Branch</Label><Input value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} /></div>
                <div><Label>Opening Balance (PKR)</Label><Input type="number" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} /></div>
                <div><Label>Opening Date</Label><Input type="date" value={f.openingDate} onChange={(e) => setF({ ...f, openingDate: e.target.value })} /></div>
              </div>
              <Button onClick={save}>Save Account</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {store.accounts.map((a) => {
          const Icon = icons[a.type] || Wallet;
          const bal = computeAccountBalance(a.id);
          const active = selected?.id === a.id;
          return (
            <button key={a.id} onClick={() => setSel(a.id)} className={`glass-card rounded-xl p-4 text-left transition-colors ${active ? "border-primary/60" : "glass-card-hover"}`}>
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.type}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">{[a.number, a.branch].filter(Boolean).join(" · ") || a.id}</p>
              <p className={`mt-2 font-display text-lg ${bal < 0 ? "text-destructive" : "text-foreground"}`}>{formatCurrency(bal)}</p>
            </button>
          );
        })}
        {store.accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet.</p>}
      </div>

      {selected && (
        <div className="glass-card rounded-xl p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="font-display text-base text-foreground">{selected.name} — Ledger</h3>
              <p className="text-xs text-muted-foreground">Opening {formatCurrency(selected.openingBalance)} on {selected.openingDate}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></div>
              <Button variant="outline" size="icon" title="Delete account" onClick={() => { if (confirm(`Delete ${selected.name}?`)) { store.deleteAccount(selected.id); setSel(null); } }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">In</th><th className="px-3 py-2 text-right">Out</th><th className="px-3 py-2 text-right">Balance</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2 capitalize">{r.description}</td>
                    <td className="px-3 py-2 text-right text-success">{r.direction === "in" ? formatCurrency(r.amount) : ""}</td>
                    <td className="px-3 py-2 text-right text-destructive">{r.direction === "out" ? formatCurrency(r.amount) : ""}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.runningBalanceAfter)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">No transactions in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
