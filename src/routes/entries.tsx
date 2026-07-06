import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatCurrency, getClientName } from "@/lib/data";
import { useStore, type LedgerEntry } from "@/lib/store";
import { getPKTDate } from "@/lib/date-utils";
import { generatePaymentReceipt } from "@/lib/pdf";
import { useState } from "react";

export const Route = createFileRoute("/entries")({
  component: EntriesPage,
  head: () => ({ meta: [{ title: "Entries — AV Travel CRM" }] }),
});

const typeLabels: Record<LedgerEntry["type"], string> = {
  client_receive: "Client Payment Received",
  purchase: "Purchase from Supplier",
  supplier_payment: "Supplier Payment",
  agent_commission: "Agent Commission",
  expense: "Expense",
};

const typeColors: Record<LedgerEntry["type"], string> = {
  client_receive: "text-success",
  purchase: "text-warning",
  supplier_payment: "text-destructive",
  agent_commission: "text-warning",
  expense: "text-destructive",
};

function buildDetailsPayload(cat: string, d: {
  adults: string; children: string; infants: string;
  adultPrice: string; childPrice: string; infantPrice: string;
  rooms: string; perNight: string; nights: string; checkIn: string; checkOut: string; hotelName: string; city: string;
  visaType: string; country: string; reference: string;
  route: string; vehicle: string; description: string;
}): LedgerEntry["purchaseDetails"] {
  const num = (v: string) => (v === "" || v == null ? undefined : Number(v) || 0);
  const str = (v: string) => (v ? v : undefined);
  const pax = {
    adults: num(d.adults), children: num(d.children), infants: num(d.infants),
    adultPrice: num(d.adultPrice), childPrice: num(d.childPrice), infantPrice: num(d.infantPrice),
  };
  if (cat === "Flight") return { ...pax, description: str(d.description) };
  if (cat === "Hotel") return { rooms: num(d.rooms), perNight: num(d.perNight), nights: num(d.nights), checkIn: str(d.checkIn), checkOut: str(d.checkOut), hotelName: str(d.hotelName), city: str(d.city), description: str(d.description) };
  if (cat === "Visa") return { ...pax, visaType: str(d.visaType), country: str(d.country), reference: str(d.reference), description: str(d.description) };
  if (cat === "Transport") return { ...pax, route: str(d.route), vehicle: str(d.vehicle), description: str(d.description) };
  // Ziyarah / Insurance / Other — also carry pax breakdown
  return { ...pax, description: str(d.description) };
}

function EntriesPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState({ date: "", type: "client_receive" as LedgerEntry["type"], headId: "", referenceId: "", referenceName: "", amount: "", note: "" });
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const emptyDetails = {
    adults: "", children: "", infants: "",
    adultPrice: "", childPrice: "", infantPrice: "",
    rooms: "", perNight: "", nights: "", checkIn: "", checkOut: "", hotelName: "", city: "",
    visaType: "", country: "", reference: "",
    route: "", vehicle: "", description: "",
  };
  const [details, setDetails] = useState<typeof emptyDetails>(emptyDetails);
  const [autoTotal, setAutoTotal] = useState(true);

  // Auto-compute purchase amount when details change (Flight / Hotel)
  function computeAutoAmount(cat: string, d: typeof emptyDetails): number | null {
    if (cat === "Hotel") {
      const r = Number(d.rooms) || 0, pn = Number(d.perNight) || 0, n = Number(d.nights) || 0;
      return r * pn * n;
    }
    // All other categories (Flight/Visa/Transport/Ziyarah/Insurance/Other) use pax pricing
    if (!cat) return null;
    const a = Number(d.adults) || 0, c = Number(d.children) || 0, i = Number(d.infants) || 0;
    const ap = Number(d.adultPrice) || 0, cp = Number(d.childPrice) || 0, ip = Number(d.infantPrice) || 0;
    if (a + c + i + ap + cp + ip === 0) return null;
    return a * ap + c * cp + i * ip;
  }
  function setDetailField<K extends keyof typeof emptyDetails>(k: K, v: string) {
    const next = { ...details, [k]: v };
    setDetails(next);
    if (autoTotal && form.type === "purchase") {
      const auto = computeAutoAmount(serviceCategory, next);
      if (auto !== null) setForm((f) => ({ ...f, amount: String(auto) }));
    }
  }

  const sorted = [...store.entries].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = typeFilter === "all" ? sorted : sorted.filter((e) => e.type === typeFilter);

  function handleAdd() {
    store.addEntry({
      date: form.date || getPKTDate(), type: form.type, headId: form.headId,
      referenceId: form.referenceId, referenceName: form.referenceName,
      amount: Number(form.amount) || 0, note: form.note,
      serviceCategory: serviceCategory || undefined,
      purchaseDetails: form.type === "purchase" ? buildDetailsPayload(serviceCategory, details) : undefined,
    });
    setForm({ date: "", type: "client_receive", headId: "", referenceId: "", referenceName: "", amount: "", note: "" });
    setServiceCategory("");
    setDetails(emptyDetails);
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateEntry(selected.id, {
      date: form.date, type: form.type, headId: form.headId,
      referenceId: form.referenceId, referenceName: form.referenceName,
      amount: Number(form.amount) || 0, note: form.note,
      serviceCategory: serviceCategory || undefined,
      purchaseDetails: form.type === "purchase" ? buildDetailsPayload(serviceCategory, details) : undefined,
    });
    setEditOpen(false);
  }

  function openEdit(e: LedgerEntry) {
    setSelected(e);
    setForm({ date: e.date, type: e.type, headId: e.headId, referenceId: e.referenceId, referenceName: e.referenceName, amount: String(e.amount), note: e.note });
    setServiceCategory(e.serviceCategory || "");
    const d = e.purchaseDetails || {};
    setDetails({
      adults: d.adults != null ? String(d.adults) : "",
      children: d.children != null ? String(d.children) : "",
      infants: d.infants != null ? String(d.infants) : "",
      adultPrice: d.adultPrice != null ? String(d.adultPrice) : "",
      childPrice: d.childPrice != null ? String(d.childPrice) : "",
      infantPrice: d.infantPrice != null ? String(d.infantPrice) : "",
      rooms: d.rooms != null ? String(d.rooms) : "",
      perNight: d.perNight != null ? String(d.perNight) : "",
      nights: d.nights != null ? String(d.nights) : "",
      checkIn: d.checkIn || "", checkOut: d.checkOut || "",
      hotelName: d.hotelName || "", city: d.city || "",
      visaType: d.visaType || "", country: d.country || "", reference: d.reference || "",
      route: d.route || "", vehicle: d.vehicle || "", description: d.description || "",
    });
    setAutoTotal(false);
    setEditOpen(true);
  }

  const totalReceived = store.entries.filter((e) => e.type === "client_receive").reduce((s, e) => s + e.amount, 0);
  const totalPaid = store.entries.filter((e) => e.type === "supplier_payment" || e.type === "agent_commission" || e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalPurchases = store.entries.filter((e) => e.type === "purchase").reduce((s, e) => s + e.amount, 0);

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
    } else if (form.type === "supplier_payment" || form.type === "purchase") {
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
            <SelectItem value="purchase">Purchase from Supplier</SelectItem>
            <SelectItem value="supplier_payment">Supplier Payment</SelectItem>
            <SelectItem value="agent_commission">Agent Commission</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-accent/20 border-border mt-1" /></div>

      {form.type === "client_receive" && (
        <div><Label>Head ID</Label>
          <SearchableSelect
            value={form.headId}
            onChange={(v) => updateReferenceId(v)}
            placeholder="Search Head ID..."
            options={store.bookings.map((b) => ({
              value: b.headId,
              label: `${b.headId} — ${b.packageType}`,
              hint: `${b.travelDate} · ${formatCurrency(b.totalAmount)}`,
            }))}
            className="mt-1"
          />
        </div>
      )}

      {(form.type === "supplier_payment" || form.type === "purchase") && (
        <div className="space-y-3">
          <div><Label>Supplier</Label>
          <SearchableSelect
            value={form.referenceId}
            onChange={(v) => updateReferenceId(v)}
            placeholder="Search Supplier..."
            options={store.suppliers.map((s) => ({
              value: s.id,
              label: `${s.id} — ${s.companyName}`,
              hint: s.serviceType,
            }))}
            className="mt-1"
          />
          </div>
          {form.type === "purchase" && (
            <>
              <div><Label>Service Category</Label>
                <Select value={serviceCategory} onValueChange={(v) => { setServiceCategory(v); const auto = computeAutoAmount(v, details); if (autoTotal && auto !== null) setForm((f) => ({ ...f, amount: String(auto) })); }}>
                  <SelectTrigger className="bg-accent/20 border-border mt-1"><SelectValue placeholder="Hotel / Flight / Visa / Transport / Other" /></SelectTrigger>
                  <SelectContent>
                    {["Hotel","Flight","Visa","Transport","Ziyarah","Insurance","Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {serviceCategory === "Flight" && (
                <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Flight Details</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Adults</Label><Input type="number" min="0" value={details.adults} onChange={(e) => setDetailField("adults", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Children</Label><Input type="number" min="0" value={details.children} onChange={(e) => setDetailField("children", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Infants</Label><Input type="number" min="0" value={details.infants} onChange={(e) => setDetailField("infants", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Adult / person</Label><Input type="number" value={details.adultPrice} onChange={(e) => setDetailField("adultPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Child / person</Label><Input type="number" value={details.childPrice} onChange={(e) => setDetailField("childPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Infant / person</Label><Input type="number" value={details.infantPrice} onChange={(e) => setDetailField("infantPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                </div>
              )}
              {serviceCategory === "Hotel" && (
                <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Hotel Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px]">Hotel Name</Label><Input value={details.hotelName} onChange={(e) => setDetailField("hotelName", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">City</Label><Input value={details.city} onChange={(e) => setDetailField("city", e.target.value)} placeholder="Makkah / Madinah" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Rooms</Label><Input type="number" min="0" value={details.rooms} onChange={(e) => setDetailField("rooms", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Per Night</Label><Input type="number" value={details.perNight} onChange={(e) => setDetailField("perNight", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Nights</Label><Input type="number" min="0" value={details.nights} onChange={(e) => setDetailField("nights", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px]">Check-in</Label><Input type="date" value={details.checkIn} onChange={(e) => setDetailField("checkIn", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Check-out</Label><Input type="date" value={details.checkOut} onChange={(e) => setDetailField("checkOut", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                </div>
              )}
              {serviceCategory === "Visa" && (
                <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Visa Details</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Visa Type</Label><Input value={details.visaType} onChange={(e) => setDetailField("visaType", e.target.value)} placeholder="Umrah / Tourist" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Country</Label><Input value={details.country} onChange={(e) => setDetailField("country", e.target.value)} placeholder="Saudi Arabia" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Reference #</Label><Input value={details.reference} onChange={(e) => setDetailField("reference", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                </div>
              )}
              {serviceCategory === "Transport" && (
                <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Transport Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-[10px]">Route</Label><Input value={details.route} onChange={(e) => setDetailField("route", e.target.value)} placeholder="JED Airport → Makkah" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Vehicle</Label><Input value={details.vehicle} onChange={(e) => setDetailField("vehicle", e.target.value)} placeholder="Private Car / Coaster" className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                  <div><Label className="text-[10px]">Description</Label><Input value={details.description} onChange={(e) => setDetailField("description", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                </div>
              )}
              {(serviceCategory === "Ziyarah" || serviceCategory === "Insurance" || serviceCategory === "Other") && (
                <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{serviceCategory} Details</p>
                  <div><Label className="text-[10px]">Description</Label><Input value={details.description} onChange={(e) => setDetailField("description", e.target.value)} placeholder={serviceCategory === "Ziyarah" ? "Makkah Ziyarat tour, Madinah Ziyarat..." : ""} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                </div>
              )}
              {serviceCategory && serviceCategory !== "Hotel" && serviceCategory !== "Flight" && (
                <div className="rounded-lg border border-border/60 bg-accent/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Passenger Breakdown</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Adults</Label><Input type="number" min="0" value={details.adults} onChange={(e) => setDetailField("adults", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Children</Label><Input type="number" min="0" value={details.children} onChange={(e) => setDetailField("children", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Infants</Label><Input type="number" min="0" value={details.infants} onChange={(e) => setDetailField("infants", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-[10px]">Adult / person</Label><Input type="number" value={details.adultPrice} onChange={(e) => setDetailField("adultPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Child / person</Label><Input type="number" value={details.childPrice} onChange={(e) => setDetailField("childPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                    <div><Label className="text-[10px]">Infant / person</Label><Input type="number" value={details.infantPrice} onChange={(e) => setDetailField("infantPrice", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                  </div>
                </div>
              )}
              <div><Label>Link to Head ID (optional)</Label>
                <SearchableSelect
                  value={form.headId}
                  onChange={(v) => setForm({ ...form, headId: v })}
                  placeholder="Tag this purchase to a booking..."
                  options={store.bookings.map((b) => ({ value: b.headId, label: `${b.headId} — ${b.packageType}`, hint: b.travelDate }))}
                  className="mt-1"
                />
              </div>
            </>
          )}
        </div>
      )}

      {form.type === "agent_commission" && (
        <div><Label>Agent</Label>
          <SearchableSelect
            value={form.referenceId}
            onChange={(v) => updateReferenceId(v)}
            placeholder="Search Agent..."
            options={store.agents.map((a) => ({
              value: a.id,
              label: `${a.id} — ${a.name}`,
              hint: a.phone,
            }))}
            className="mt-1"
          />
        </div>
      )}

      {form.type === "expense" && (
        <div><Label>Expense Name</Label><Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })} placeholder="Office Rent, Utilities..." className="bg-accent/20 border-border mt-1" /></div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <Label>Amount (PKR)</Label>
          {form.type === "purchase" && serviceCategory && (
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={autoTotal} onChange={(e) => setAutoTotal(e.target.checked)} className="rounded" />
              Auto-calc
            </label>
          )}
        </div>
        <Input type="number" value={form.amount} onChange={(e) => { setAutoTotal(false); setForm({ ...form, amount: e.target.value }); }} placeholder="100000" className="bg-accent/20 border-border mt-1" />
      </div>
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
              <Button className="gap-2" onClick={() => { setForm({ date: getPKTDate(), type: "client_receive", headId: "", referenceId: "", referenceName: "", amount: "", note: "" }); setDetails(emptyDetails); setServiceCategory(""); setAutoTotal(true); }}>
                <Plus className="h-4 w-4" /> New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New Entry</DialogTitle></DialogHeader>
              {formFields}
              <Button onClick={handleAdd} className="w-full">Submit Entry</Button>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Received</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-[10px] uppercase text-muted-foreground">Total Purchases</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(totalPurchases)}</p>
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
        {(["all", "client_receive", "purchase", "supplier_payment", "agent_commission", "expense"] as const).map((t) => (
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
                      <button onClick={() => generatePaymentReceipt(e)} className="rounded p-1 hover:bg-accent" title="Download Receipt"><Download className="h-3.5 w-3.5 text-success" /></button>
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
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Entry — {selected?.id}</DialogTitle></DialogHeader>
          {formFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
