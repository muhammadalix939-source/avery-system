import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getClientName } from "@/lib/data";
import { useStore, entryDirection, type LedgerEntry } from "@/lib/store";
import { supplierOpenItems, distributeSupplierPayment, settlementState } from "@/lib/settlement";
import { getPKTDate } from "@/lib/date-utils";

type EntryKind = "purchase" | "sale" | "other_sale" | "supplier_payment" | "agent_receive" | "gift" | "drawing";

const KINDS: { key: EntryKind; label: string }[] = [
  { key: "purchase", label: "Purchase" },
  { key: "sale", label: "Sale" },
  { key: "other_sale", label: "Other Sale" },
  { key: "supplier_payment", label: "Supplier Paid" },
  { key: "agent_receive", label: "Agent Receipt" },
  { key: "gift", label: "Gift & Expense" },
  { key: "drawing", label: "Drawing" },
];

const METHODS = ["Cash", "Bank", "Mobile Wallet", "Cheque"] as const;

/** Unified New Entry flow — segmented entry type with conditional fields per type. */
export default function NewEntryDialog({ triggerClassName }: { triggerClassName?: string }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EntryKind>("purchase");
  const [f, setF] = useState({
    supplierId: "", purchasedFor: "client" as "client" | "agent", headId: "", agentId: "",
    item: "", amount: "", agentSaleAmount: "", date: getPKTDate(), reference: "", reflectClient: false,
    clientId: "", giftCategory: "Expense" as "Gift" | "Expense", purpose: "", accountId: "",
    viaAgent: false, note: "",
    method: "Cash" as (typeof METHODS)[number],
    // service identifiers
    ticketNumber: "", pnr: "", airline: "", sector: "", travelDate: "", visaNumber: "",
    // beneficiary (counter-party receiving account) slip data
    benMethod: "Cash" as (typeof METHODS)[number],
    benBank: "", benTitle: "", benAccount: "", benStart: "", benEnd: "", benSlipRef: "",
    allocIds: [] as string[],
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  const heads = useMemo(() => {
    const seen = new Map<string, string>();
    store.clients.forEach((c) => { if (!seen.has(c.headId)) seen.set(c.headId, `${c.headId} — ${getClientName(c)}`); });
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [store.clients]);

  const accountOptions = store.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }));
  const agentOptions = store.agents.map((a) => ({ value: a.id, label: `${a.id} — ${a.name}` }));
  const openItems = useMemo(
    () => (f.supplierId ? supplierOpenItems(store.entries, f.supplierId).filter((o) => o.balance > 0) : []),
    [f.supplierId, store.entries],
  );
  const needsAccount = kind === "sale" || kind === "drawing" || kind === "other_sale" || kind === "supplier_payment" || kind === "agent_receive" || (kind === "gift" && !!f.accountId);

  function reset() {
    setF({
      supplierId: "", purchasedFor: "client", headId: "", agentId: "", item: "", amount: "", agentSaleAmount: "",
      date: getPKTDate(), reference: "", reflectClient: false, clientId: "", giftCategory: "Expense", purpose: "",
      accountId: "", viaAgent: false, note: "", method: "Cash",
      ticketNumber: "", pnr: "", airline: "", sector: "", travelDate: "", visaNumber: "",
      benMethod: "Cash", benBank: "", benTitle: "", benAccount: "", benStart: "", benEnd: "", benSlipRef: "",
      allocIds: [],
    });
  }

  const serviceRef = () => {
    const r = {
      ticketNumber: f.ticketNumber || undefined, pnr: f.pnr || undefined, airline: f.airline || undefined,
      sector: f.sector || undefined, travelDate: f.travelDate || undefined, visaNumber: f.visaNumber || undefined,
    };
    return Object.values(r).some(Boolean) ? r : undefined;
  };

  const beneficiary = () => {
    const b = {
      method: f.benMethod, bankName: f.benBank || undefined, accountTitle: f.benTitle || undefined,
      accountNumber: f.benAccount || undefined, startDigits: f.benStart || undefined,
      endDigits: f.benEnd || undefined, slipRef: f.benSlipRef || undefined,
    };
    return Object.entries(b).some(([k, v]) => k !== "method" && !!v) ? b : { method: f.benMethod };
  };

  function save() {
    const amount = Number(f.amount) || 0;
    if (amount <= 0) { toast.error("Enter an amount"); return; }

    let type: LedgerEntry["type"] = "purchase";
    let referenceId = "";
    let referenceName = "";
    let note = f.note || f.item || f.purpose;

    if (kind === "purchase") {
      if (!f.supplierId) { toast.error("Select a supplier"); return; }
      type = "purchase";
      referenceId = f.supplierId;
      referenceName = store.suppliers.find((s) => s.id === f.supplierId)?.companyName || "";
    } else if (kind === "sale") {
      if (!f.headId) { toast.error("Select a head / group"); return; }
      if (!f.accountId) { toast.error("Select the account the money was received in"); return; }
      type = "client_receive";
      const lead = store.clients.find((c) => c.headId === f.headId);
      referenceId = f.clientId || lead?.id || f.headId;
      referenceName = f.clientId ? getClientName(store.clients.find((c) => c.id === f.clientId)!) : lead ? getClientName(lead) : f.headId;
    } else if (kind === "other_sale") {
      type = "other_sale";
      referenceId = f.agentId;
      referenceName = store.agents.find((a) => a.id === f.agentId)?.name || f.purpose || "Other Sale";
      note = f.purpose || f.item;
    } else if (kind === "supplier_payment") {
      if (!f.supplierId) { toast.error("Select a supplier"); return; }
      if (!f.accountId) { toast.error("Select the account the payment was made from"); return; }
      type = "supplier_payment";
      referenceId = f.supplierId;
      referenceName = store.suppliers.find((s) => s.id === f.supplierId)?.companyName || "";
      note = f.note || `Payment to supplier (${f.method})`;
    } else if (kind === "agent_receive") {
      if (!f.agentId) { toast.error("Select an agent"); return; }
      if (!f.accountId) { toast.error("Select the account the money was received in"); return; }
      type = "agent_receive";
      referenceId = f.agentId;
      referenceName = store.agents.find((a) => a.id === f.agentId)?.name || f.agentId;
      note = f.note || f.purpose || "Received from agent";
    } else if (kind === "gift") {
      type = "gift";
      referenceId = f.agentId || f.headId;
      referenceName = f.purpose || f.giftCategory;
      note = `${f.giftCategory}: ${f.purpose}`;
    } else {
      if (!f.accountId) { toast.error("Select the account the drawing is paid from"); return; }
      type = "drawing";
      referenceName = "Owner / Partner Drawing";
      note = f.note || "Owner personal withdrawal";
    }

    const allocations =
      kind === "supplier_payment" ? distributeSupplierPayment(openItems, amount, f.allocIds).allocations : undefined;

    store.addEntry({
      date: f.date, type,
      headId:
        kind === "purchase" && f.purchasedFor === "client" ? f.headId
          : kind === "sale" || kind === "gift" || kind === "supplier_payment" ? f.headId
          : "",
      referenceId, referenceName, amount, note,
      accountId: f.accountId || undefined,
      direction: entryDirection(type),
      agentId: f.agentId || undefined,
      clientId: kind === "sale" ? f.clientId || undefined : undefined,
      purchasedFor: kind === "purchase" ? f.purchasedFor : undefined,
      reflectInClientLedger: kind === "purchase" ? f.reflectClient : undefined,
      giftCategory: kind === "gift" ? f.giftCategory : undefined,
      reconciled: kind === "purchase" ? "recorded" : undefined,
      chargeCategory: kind === "purchase" ? f.item : undefined,
      paidBy: f.reference || undefined,
      paymentMethod: f.method,
      referenceNo: f.reference || undefined,
      serviceRef: kind === "purchase" ? serviceRef() : undefined,
      beneficiary: kind === "supplier_payment" ? beneficiary() : undefined,
      allocations: allocations && allocations.length ? allocations : undefined,
      agentSaleAmount: kind === "purchase" && f.purchasedFor === "agent" ? Number(f.agentSaleAmount) || undefined : undefined,
    });

    // Purchase bought for an agent and re-sold to him → book the agent sale side too.
    if (kind === "purchase" && f.purchasedFor === "agent" && f.agentId && Number(f.agentSaleAmount) > 0) {
      const agent = store.agents.find((a) => a.id === f.agentId);
      store.addEntry({
        date: f.date, type: "other_sale", headId: "",
        referenceId: f.agentId, referenceName: agent?.name || f.agentId,
        amount: Number(f.agentSaleAmount),
        note: `Sold to agent — ${f.item || "service"}`,
        agentId: f.agentId,
        direction: entryDirection("other_sale"),
        serviceRef: serviceRef(),
        referenceNo: f.reference || undefined,
      });
    }

    // Purchase for a client that must also hit the client's personal balance
    if (kind === "purchase" && f.purchasedFor === "client" && f.headId && f.reflectClient) {
      store.addEntry({
        date: f.date, type: "client_charge", headId: f.headId,
        referenceId: f.headId, referenceName: f.item || "Purchase cost",
        amount, note: `Purchase billed to client — ${f.item}`,
        chargeCategory: f.item || "Purchase cost",
      });
    }

    toast.success(`Entry posted — ${formatCurrency(amount)}`);
    reset();
    setOpen(false);
  }

  const field = "bg-accent/20 border-border mt-1 h-9 text-xs";
  const margin = Number(f.agentSaleAmount) - Number(f.amount);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className={`gap-2 ${triggerClassName || ""}`}><Plus className="h-4 w-4" /> New Entry</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl border-border bg-card">
        <DialogHeader><DialogTitle>New Entry</DialogTitle></DialogHeader>

        <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-accent/10 p-1">
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => setKind(k.key)}
              className={`rounded-md px-2 py-2 text-[11px] font-semibold transition-all ${kind === k.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {kind === "purchase" && (
            <>
              <div><Label className="text-xs">Supplier *</Label>
                <SearchableSelect value={f.supplierId} onChange={(v) => set({ supplierId: v })} placeholder="Search supplier"
                  options={store.suppliers.map((s) => ({ value: s.id, label: `${s.companyName} (${s.serviceType})` }))} />
              </div>
              <div>
                <Label className="text-xs">Purchased For</Label>
                <div className="mt-1 flex gap-2">
                  {(["agent", "client"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => set({ purchasedFor: v })}
                      className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium capitalize ${f.purchasedFor === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {f.purchasedFor === "agent" && (
                <>
                  <div><Label className="text-xs">Agent *</Label>
                    <SearchableSelect value={f.agentId} onChange={(v) => set({ agentId: v })} placeholder="Search agent" options={agentOptions} />
                  </div>
                  <div><Label className="text-xs">Sale Price to Agent (PKR)</Label>
                    <Input type="number" value={f.agentSaleAmount} onChange={(e) => set({ agentSaleAmount: e.target.value })} className={field} placeholder="What the agent will pay us" />
                  </div>
                  {Number(f.agentSaleAmount) > 0 && Number(f.amount) > 0 && (
                    <p className={`text-[11px] ${margin >= 0 ? "text-success" : "text-destructive"}`}>
                      Supplier cost {formatCurrency(Number(f.amount))} · Agent price {formatCurrency(Number(f.agentSaleAmount))} · Margin {formatCurrency(margin)}
                    </p>
                  )}
                </>
              )}
              {f.purchasedFor === "client" && (
                <>
                  <div><Label className="text-xs">Head / Group</Label>
                    <SearchableSelect value={f.headId} onChange={(v) => set({ headId: v })} placeholder="Search head" options={heads} />
                  </div>
                  {f.headId && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-accent/10 p-3">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-medium">Also reflect in Client Personal Ledger</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Off = this cost only affects group profitability. On = this client personally owes this amount.</p>
                        </div>
                      </div>
                      <Switch checked={f.reflectClient} onCheckedChange={(v) => set({ reflectClient: v })} />
                    </div>
                  )}
                </>
              )}
              <div><Label className="text-xs">Item / Service</Label><Input value={f.item} onChange={(e) => set({ item: e.target.value })} className={field} placeholder="Hotel, Ticket, Visa…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Ticket / Document No.</Label><Input value={f.ticketNumber} onChange={(e) => set({ ticketNumber: e.target.value })} className={field} /></div>
                <div><Label className="text-xs">PNR</Label><Input value={f.pnr} onChange={(e) => set({ pnr: e.target.value })} className={field} /></div>
                <div><Label className="text-xs">Airline</Label><Input value={f.airline} onChange={(e) => set({ airline: e.target.value })} className={field} /></div>
                <div><Label className="text-xs">Sector</Label><Input value={f.sector} onChange={(e) => set({ sector: e.target.value })} className={field} placeholder="KHI–JED" /></div>
                <div><Label className="text-xs">Travel Date</Label><Input type="date" value={f.travelDate} onChange={(e) => set({ travelDate: e.target.value })} className={field} /></div>
                <div><Label className="text-xs">Visa No.</Label><Input value={f.visaNumber} onChange={(e) => set({ visaNumber: e.target.value })} className={field} /></div>
              </div>
            </>
          )}

          {kind === "sale" && (
            <>
              <div><Label className="text-xs">Head / Group *</Label>
                <SearchableSelect value={f.headId} onChange={(v) => set({ headId: v, clientId: "" })} placeholder="Search head" options={heads} />
              </div>
              {f.headId && (
                <div><Label className="text-xs">Member (optional)</Label>
                  <SearchableSelect value={f.clientId} onChange={(v) => set({ clientId: v })} placeholder="Whole head"
                    options={store.clients.filter((c) => c.headId === f.headId).map((c) => ({ value: c.id, label: getClientName(c) }))} />
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-accent/10 p-3">
                <p className="text-xs font-medium">Via Agent</p>
                <Switch checked={f.viaAgent} onCheckedChange={(v) => set({ viaAgent: v, agentId: v ? f.agentId : "" })} />
              </div>
              {f.viaAgent && (
                <div><Label className="text-xs">Agent ID</Label>
                  <SearchableSelect value={f.agentId} onChange={(v) => set({ agentId: v })} placeholder="Search agent" options={agentOptions} />
                </div>
              )}
              <div><Label className="text-xs">Received In (Account) *</Label>
                <SearchableSelect value={f.accountId} onChange={(v) => set({ accountId: v })} placeholder="Select account" options={accountOptions} />
              </div>
            </>
          )}

          {kind === "other_sale" && (
            <>
              <div><Label className="text-xs">Description</Label><Input value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} className={field} placeholder="Ticket only, visa service…" /></div>
              <div><Label className="text-xs">Link to Agent (optional)</Label>
                <SearchableSelect value={f.agentId} onChange={(v) => set({ agentId: v })} placeholder="Search agent" options={agentOptions} />
              </div>
              <div><Label className="text-xs">Received In (Account)</Label>
                <SearchableSelect value={f.accountId} onChange={(v) => set({ accountId: v })} placeholder="Select account" options={accountOptions} />
              </div>
            </>
          )}

          {kind === "supplier_payment" && (
            <>
              <div><Label className="text-xs">Supplier *</Label>
                <SearchableSelect value={f.supplierId} onChange={(v) => set({ supplierId: v, allocIds: [] })} placeholder="Search supplier"
                  options={store.suppliers.map((s) => ({ value: s.id, label: `${s.companyName} (${s.serviceType})` }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Against Agent (optional)</Label>
                  <SearchableSelect value={f.agentId} onChange={(v) => set({ agentId: v })} placeholder="None" options={agentOptions} />
                </div>
                <div><Label className="text-xs">Against Head / Group (optional)</Label>
                  <SearchableSelect value={f.headId} onChange={(v) => set({ headId: v })} placeholder="None" options={heads} />
                </div>
              </div>
              <div><Label className="text-xs">Paid From (Account) *</Label>
                <SearchableSelect value={f.accountId} onChange={(v) => set({ accountId: v })} placeholder="Select account" options={accountOptions} />
              </div>
              {openItems.length > 0 && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Settle Against (optional — else oldest first)</p>
                  <div className="space-y-1.5">
                    {openItems.map((o) => {
                      const on = f.allocIds.includes(o.entry.id);
                      return (
                        <button key={o.entry.id} type="button"
                          onClick={() => set({ allocIds: on ? f.allocIds.filter((x) => x !== o.entry.id) : [...f.allocIds, o.entry.id] })}
                          className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs ${on ? "border-primary bg-primary/10" : "border-border/60 bg-accent/10"}`}>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{o.label}</span>
                            <span className="block text-[10px] text-muted-foreground">{o.entry.date} · {o.tag} · {settlementState(o)}</span>
                          </span>
                          <span className="shrink-0 font-semibold">{formatCurrency(o.balance)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-border/60 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier Receiving Account (Slip Detail)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Received In</Label>
                    <Select value={f.benMethod} onValueChange={(v) => set({ benMethod: v as (typeof METHODS)[number] })}>
                      <SelectTrigger className={field}><SelectValue /></SelectTrigger>
                      <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Bank / Wallet</Label><Input value={f.benBank} onChange={(e) => set({ benBank: e.target.value })} className={field} /></div>
                  <div><Label className="text-xs">Account Title</Label><Input value={f.benTitle} onChange={(e) => set({ benTitle: e.target.value })} className={field} /></div>
                  <div><Label className="text-xs">Account Number</Label><Input value={f.benAccount} onChange={(e) => set({ benAccount: e.target.value })} className={field} /></div>
                  <div><Label className="text-xs">Start Digits</Label><Input value={f.benStart} onChange={(e) => set({ benStart: e.target.value })} className={field} /></div>
                  <div><Label className="text-xs">End Digits</Label><Input value={f.benEnd} onChange={(e) => set({ benEnd: e.target.value })} className={field} /></div>
                  <div className="col-span-2"><Label className="text-xs">Slip / Transaction Ref</Label><Input value={f.benSlipRef} onChange={(e) => set({ benSlipRef: e.target.value })} className={field} /></div>
                </div>
              </div>
            </>
          )}

          {kind === "agent_receive" && (
            <>
              <div><Label className="text-xs">Agent *</Label>
                <SearchableSelect value={f.agentId} onChange={(v) => set({ agentId: v })} placeholder="Search agent" options={agentOptions} />
              </div>
              <div><Label className="text-xs">Against</Label><Input value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} className={field} placeholder="Other sale / package balance" /></div>
              <div><Label className="text-xs">Received In (Account) *</Label>
                <SearchableSelect value={f.accountId} onChange={(v) => set({ accountId: v })} placeholder="Select account" options={accountOptions} />
              </div>
              <div><Label className="text-xs">Against Head / Group (optional)</Label>
                <SearchableSelect value={f.headId} onChange={(v) => set({ headId: v })} placeholder="None" options={heads} />
              </div>
            </>
          )}

          {kind === "gift" && (
            <>
              <div><Label className="text-xs">Category</Label>
                <Select value={f.giftCategory} onValueChange={(v) => set({ giftCategory: v as "Gift" | "Expense" })}>
                  <SelectTrigger className={field}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Gift" className="text-xs">Gift</SelectItem><SelectItem value="Expense" className="text-xs">Expense</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Purpose / Recipient</Label><Input value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} className={field} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Link to Head (optional)</Label>
                  <SearchableSelect value={f.headId} onChange={(v) => set({ headId: v })} placeholder="None" options={heads} />
                </div>
                <div><Label className="text-xs">Link to Agent (optional)</Label>
                  <SearchableSelect value={f.agentId} onChange={(v) => set({ agentId: v })} placeholder="None" options={agentOptions} />
                </div>
              </div>
              <div><Label className="text-xs">Paid From (Account, if cash/bank paid)</Label>
                <SearchableSelect value={f.accountId} onChange={(v) => set({ accountId: v })} placeholder="Booked only" options={accountOptions} />
              </div>
            </>
          )}

          {kind === "drawing" && (
            <>
              <div><Label className="text-xs">Paid From (Account) *</Label>
                <SearchableSelect value={f.accountId} onChange={(v) => set({ accountId: v })} placeholder="Select account" options={accountOptions} />
              </div>
              <div><Label className="text-xs">Note</Label><Input value={f.note} onChange={(e) => set({ note: e.target.value })} className={field} placeholder="Owner personal withdrawal" /></div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">{kind === "purchase" ? "Supplier Cost (PKR) *" : "Amount (PKR) *"}</Label><Input type="number" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className={field} /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className={field} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Payment Method</Label>
              <Select value={f.method} onValueChange={(v) => set({ method: v as (typeof METHODS)[number] })}>
                <SelectTrigger className={field}><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Reference #</Label><Input value={f.reference} onChange={(e) => set({ reference: e.target.value })} className={field} placeholder="Slip / cheque / txn no." /></div>
          </div>
          {needsAccount && f.accountId && (
            <p className="text-[11px] text-muted-foreground">
              This posting is permanent once saved — corrections are made with a linked reversal entry.
            </p>
          )}
        </div>

        <Button onClick={save} className="w-full">Post Entry</Button>
      </DialogContent>
    </Dialog>
  );
}
