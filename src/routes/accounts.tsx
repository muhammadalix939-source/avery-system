import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, Building2, Plus, Smartphone, Trash2, Pencil, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/lib/data";
import { buildAccountLedger, computeAccountBalance, useStore, type Account } from "@/lib/store";

export const Route = createFileRoute("/accounts")({
  component: AccountsPage,
  head: () => ({ meta: [
    { title: "Accounts & Cashbook — AV Travel CRM" },
    { name: "description", content: "Live cash, bank and wallet balances with a permanent transaction ledger." },
    { property: "og:title", content: "Accounts & Cashbook — AV Travel CRM" },
    { property: "og:description", content: "Reconcile every receipt and payment against its physical cash or bank account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const empty = { name: "", type: "Cash" as Account["type"], number: "", branch: "", openingBalance: "0", openingDate: new Date().toISOString().slice(0, 10) };

function AccountsPage() {
  const store = useStore();
  const [selectedId, setSelectedId] = useState(store.accounts[0]?.id || "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(empty);
  const selected = store.accounts.find((a) => a.id === selectedId) || store.accounts[0];
  const ledger = useMemo(() => selected ? buildAccountLedger(selected.id) : [], [selected, store.entries]);
  const total = store.accounts.reduce((sum, a) => sum + computeAccountBalance(a.id), 0);

  function submit() {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), type: form.type, number: form.number || undefined, branch: form.branch || undefined, openingBalance: Number(form.openingBalance) || 0, openingDate: form.openingDate };
    if (editing) store.updateAccount(editing.id, payload);
    else { const id = store.addAccount(payload); setSelectedId(id); }
    setForm(empty); setEditing(null); setOpen(false);
  }
  function edit(account: Account) { setEditing(account); setForm({ name: account.name, type: account.type, number: account.number || "", branch: account.branch || "", openingBalance: String(account.openingBalance), openingDate: account.openingDate }); setOpen(true); }
  function add() { setEditing(null); setForm(empty); setOpen(true); }
  const Icon = selected?.type === "Bank" ? Building2 : selected?.type === "Mobile Wallet" ? Smartphone : Banknote;

  return <div className="space-y-6">
    <PageHeader title="Accounts & Cashbook" subtitle="Every receipt and payout reconciled to its physical account" actions={<Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Add Account</Button>} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {store.accounts.map((account) => {
        const balance = computeAccountBalance(account.id);
        const ActiveIcon = account.id === selected?.id ? Icon : account.type === "Bank" ? Building2 : account.type === "Mobile Wallet" ? Smartphone : Banknote;
        return <button type="button" key={account.id} onClick={() => setSelectedId(account.id)} className={`glass-card rounded-xl p-5 text-left transition-all hover:border-primary/50 ${account.id === selected?.id ? "border-primary/60 bg-primary/5" : ""}`}>
          <div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><ActiveIcon className="h-5 w-5 text-primary" /></div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{account.type}</span></div>
          <p className="mt-4 text-sm font-semibold">{account.name}</p><p className="text-[10px] text-muted-foreground">{account.number || account.id}{account.branch ? ` · ${account.branch}` : ""}</p>
          <p className={`mt-3 text-xl font-bold ${balance >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(balance)}</p>
          <div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={(e) => { e.stopPropagation(); edit(account); }}><Pencil className="h-3 w-3" /> Edit</Button>{store.accounts.length > 1 && <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); store.deleteAccount(account.id); if (selectedId === account.id) setSelectedId(store.accounts.find((x) => x.id !== account.id)?.id || ""); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>}</div>
        </button>;
      })}
    </div>
    {selected && <div className="glass-card rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 p-5"><div><h2 className="text-sm font-semibold">{selected.name} Ledger</h2><p className="text-xs text-muted-foreground">Opening balance {formatCurrency(selected.openingBalance)} · {selected.openingDate}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current balance</p><p className="text-lg font-bold text-primary">{formatCurrency(computeAccountBalance(selected.id))}</p></div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Date</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Type</th><th className="px-5 py-3 text-right">In</th><th className="px-5 py-3 text-right">Out</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody>{ledger.map((row) => <tr key={row.id} className="border-b border-border/40"><td className="px-5 py-3 text-xs">{row.date}</td><td className="px-5 py-3 text-xs">{row.description}</td><td className="px-5 py-3 text-[10px] uppercase text-muted-foreground">{row.transactionType.replace(/_/g, " ")}</td><td className="px-5 py-3 text-right text-xs text-success">{row.direction === "in" ? <span className="inline-flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" />{formatCurrency(row.amount)}</span> : "—"}</td><td className="px-5 py-3 text-right text-xs text-destructive">{row.direction === "out" ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{formatCurrency(row.amount)}</span> : "—"}</td><td className="px-5 py-3 text-right text-xs font-semibold">{formatCurrency(row.runningBalanceAfter)}</td></tr>)}</tbody></table></div>
      {ledger.length === 0 && <p className="p-8 text-center text-xs text-muted-foreground">No transactions posted to this account yet.</p>}
    </div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><span /></DialogTrigger><DialogContent className="border-border bg-card"><DialogHeader><DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader><div className="space-y-3"><div><Label className="text-xs">Account name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" placeholder="Main Bank Account" /></div><div><Label className="text-xs">Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Account["type"] })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank">Bank</SelectItem><SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">Account / IBAN</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="mt-1" /></div><div><Label className="text-xs">Branch / Provider</Label><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="mt-1" /></div></div><div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">Opening balance</Label><Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} className="mt-1" /></div><div><Label className="text-xs">Opening date</Label><Input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} className="mt-1" /></div></div><Button onClick={submit} className="w-full">{editing ? "Save Changes" : "Create Account"}</Button></div></DialogContent></Dialog>
  </div>;
}
