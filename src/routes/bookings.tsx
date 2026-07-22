import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Eye, Trash2, Pencil, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { SearchableSelect } from "@/components/SearchableSelect";
import BookingServicesMenu, { VoucherDownloadMenu } from "@/components/BookingServicesMenu";
import { formatCurrency, getClientName, PACKAGE_TYPES, type Booking, type Client } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeGroupUsedPax } from "@/lib/store";
import { getPKTDate } from "@/lib/date-utils";
import { generateInvoice, generatePaymentHistory } from "@/lib/pdf";
import { useState } from "react";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Bookings — AV Travel CRM" }] }),
});

interface MemberForm {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Custom";
  ageCategory: "Adult" | "Child" | "Infant";
  nationality: string;
  passport: string;
  cnic: string;
  dateOfBirth: string;
  dateOfIssue: string;
  dateOfExpire: string;
  phone: string;
  email: string;
}

const emptyMember: MemberForm = {
  firstName: "", lastName: "", gender: "Male", ageCategory: "Adult", nationality: "", passport: "", cnic: "",
  dateOfBirth: "", dateOfIssue: "", dateOfExpire: "", phone: "", email: "",
};

function BookingsPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [step, setStep] = useState(1);

  const [memberEditOpen, setMemberEditOpen] = useState(false);
  const [memberEdit, setMemberEdit] = useState<Client | null>(null);

  const [form, setForm] = useState({
    agentId: "", supplierId: "", totalAmount: "", amountReceived: "", totalCost: "", commission: "",
    packageType: "Umrah" as Booking["packageType"], status: "Pending" as Booking["status"],
    travelDate: "", adults: "1", children: "0", infants: "0", destination: "", driveLink: "",
    pricingMode: "total" as "total" | "per_person",
    adultPrice: "", childPrice: "", infantPrice: "",
  });

  const [memberForms, setMemberForms] = useState<MemberForm[]>([]);
  const [memberIndex, setMemberIndex] = useState(0);

  // Group / PNR selection for the booking (linked to supplier)
  const [groupMode, setGroupMode] = useState<"none" | "existing" | "new">("none");
  const [groupId, setGroupId] = useState<string>("");
  const [newGroup, setNewGroup] = useState({ name: "", pnr: "", flightNumber: "", date: "", description: "", totalPax: "" });

  function resetForm() {
    setForm({ agentId: "", supplierId: "", totalAmount: "", amountReceived: "", totalCost: "", commission: "", packageType: "Umrah", status: "Pending", travelDate: "", adults: "1", children: "0", infants: "0", destination: "", driveLink: "", pricingMode: "total", adultPrice: "", childPrice: "", infantPrice: "" });
    setMemberForms([]);
    setMemberIndex(0);
    setStep(1);
    setGroupMode("none"); setGroupId(""); setNewGroup({ name: "", pnr: "", flightNumber: "", date: "", description: "", totalPax: "" });
  }

  function goToStep2() {
    const adults = Math.max(0, Number(form.adults) || 0);
    const children = Math.max(0, Number(form.children) || 0);
    const infants = Math.max(0, Number(form.infants) || 0);
    const total = Math.max(1, adults + children + infants);
    const built: MemberForm[] = [];
    for (let i = 0; i < total; i++) {
      const existing = memberForms[i];
      const category: "Adult" | "Child" | "Infant" =
        i < adults ? "Adult" : i < adults + children ? "Child" : "Infant";
      built.push(existing ? { ...existing, ageCategory: category } : { ...emptyMember, ageCategory: category });
    }
    setMemberForms(built);
    setMemberIndex(0);
    setStep(2);
  }

  // Auto-fill: when member 1 changes shared fields, propagate to others that are still empty
  function updateMember(index: number, field: keyof MemberForm, value: string) {
    const arr = [...memberForms];
    arr[index] = { ...arr[index], [field]: value };

    // If editing member 1, auto-fill shared fields to other members (only if they're empty)
    if (index === 0) {
      const sharedFields: (keyof MemberForm)[] = ["nationality", "phone", "email"];
      if (sharedFields.includes(field)) {
        for (let i = 1; i < arr.length; i++) {
          if (!arr[i][field]) {
            arr[i] = { ...arr[i], [field]: value };
          }
        }
      }
    }
    setMemberForms(arr);
  }

  function handleAdd() {
    const headId = store.generateHeadId();
    const today = getPKTDate();

    // Compute per-member due based on pricing mode
    const adultsCount = memberForms.filter((m) => m.ageCategory === "Adult").length;
    const childrenCount = memberForms.filter((m) => m.ageCategory === "Child").length;
    const infantsCount = memberForms.filter((m) => m.ageCategory === "Infant").length;
    const childPrice = Number(form.childPrice) || 0;
    const infantPrice = Number(form.infantPrice) || 0;
    let adultPrice = 0;
    let computedTotal = 0;
    if (form.pricingMode === "per_person") {
      adultPrice = Number(form.adultPrice) || 0;
      computedTotal = adultPrice * adultsCount + childPrice * childrenCount + infantPrice * infantsCount;
    } else {
      // total mode: form.totalAmount is package total; child/infant priced separately, remainder split across adults
      const totalEntered = Number(form.totalAmount) || 0;
      const adultPortion = Math.max(0, totalEntered - childPrice * childrenCount - infantPrice * infantsCount);
      adultPrice = adultsCount > 0 ? Math.round(adultPortion / adultsCount) : 0;
      computedTotal = totalEntered;
    }

    // Resolve group linkage (create new if requested)
    let finalGroupId: string | undefined = groupMode === "existing" ? (groupId || undefined) : undefined;
    if (groupMode === "new" && newGroup.name.trim()) {
      finalGroupId = store.addGroup({
        name: newGroup.name.trim(),
        category: "Booking",
        supplierId: form.supplierId || undefined,
        pnr: newGroup.pnr || undefined,
        flightNumber: newGroup.flightNumber || undefined,
        date: newGroup.date || form.travelDate || undefined,
        description: newGroup.description || undefined,
        totalPax: newGroup.totalPax ? Number(newGroup.totalPax) : undefined,
      });
    }

    const bookingId = store.addBooking({
      headId, agentId: form.agentId, supplierId: form.supplierId,
      totalAmount: computedTotal, amountReceived: Number(form.amountReceived) || 0,
      totalCost: Number(form.totalCost) || 0, commission: Number(form.commission) || 0,
      clientIds: [], status: form.status, packageType: form.packageType, travelDate: form.travelDate,
      createdAt: today, members: memberForms.length,
      destination: form.destination, driveLink: form.driveLink,
      groupId: finalGroupId,
    });

    const clientIds: string[] = [];
    memberForms.forEach((m, i) => {
      const due =
        m.ageCategory === "Child" ? childPrice :
        m.ageCategory === "Infant" ? infantPrice :
        adultPrice;
      const cid = store.addClient({
        headId,
        firstName: m.firstName || `Member`,
        lastName: m.lastName || `${i + 1}`,
        gender: m.gender,
        ageCategory: m.ageCategory,
        nationality: m.nationality || memberForms[0]?.nationality || "",
        passport: m.passport,
        cnic: m.cnic,
        dateOfBirth: m.dateOfBirth,
        dateOfIssue: m.dateOfIssue,
        dateOfExpire: m.dateOfExpire,
        phone: m.phone || memberForms[0]?.phone || "",
        email: m.email || memberForms[0]?.email || "",
        packageType: form.packageType,
        paymentStatus: "Unpaid",
        amountDue: due,
        amountPaid: 0,
        isVip: false,
        destination: form.destination,
        driveLink: form.driveLink,
      });
      clientIds.push(cid);
    });

    store.updateBooking(bookingId, { clientIds });

    // Auto-create ledger entries
    if (Number(form.amountReceived) > 0) {
      store.addEntry({
        date: today, type: "client_receive", headId, referenceId: headId,
        referenceName: `Booking ${headId}`, amount: Number(form.amountReceived),
        note: `Initial payment for ${headId}`,
      });
    }

    // Auto-add supplier cost entry
    if (Number(form.totalCost) > 0 && form.supplierId) {
      const supplier = store.suppliers.find((s) => s.id === form.supplierId);
      store.addEntry({
        date: today, type: "supplier_payment", headId, referenceId: form.supplierId,
        referenceName: supplier?.companyName || form.supplierId, amount: Number(form.totalCost),
        note: `Supplier cost for ${headId}`,
      });
    }

    // Auto-add agent commission entry
    if (Number(form.commission) > 0 && form.agentId && form.agentId !== "Direct") {
      const agent = store.agents.find((a) => a.id === form.agentId);
      if (agent) {
        // Update agent stats
        store.updateAgent(agent.id, {
          totalSales: agent.totalSales + (Number(form.totalAmount) || 0),
          totalClients: agent.totalClients + memberForms.length,
          commission: agent.commission + (Number(form.commission) || 0),
        });
      }
    }

    // Update supplier totalPayable
    if (Number(form.totalCost) > 0 && form.supplierId) {
      const supplier = store.suppliers.find((s) => s.id === form.supplierId);
      if (supplier) {
        store.updateSupplier(supplier.id, {
          totalPayable: supplier.totalPayable + (Number(form.totalCost) || 0),
        });
      }
    }

    resetForm();
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    const cs = store.clients.filter((c) => c.headId === selected.headId);
    const adults = cs.filter((c) => (c.ageCategory || "Adult") === "Adult");
    const children = cs.filter((c) => c.ageCategory === "Child");
    const infants = cs.filter((c) => c.ageCategory === "Infant");
    const childPrice = Number(form.childPrice) || 0;
    const infantPrice = Number(form.infantPrice) || 0;
    let adultPrice = 0;
    let computedTotal = 0;
    if (form.pricingMode === "per_person") {
      adultPrice = Number(form.adultPrice) || 0;
      computedTotal = adultPrice * adults.length + childPrice * children.length + infantPrice * infants.length;
    } else {
      computedTotal = Number(form.totalAmount) || 0;
      const rem = Math.max(0, computedTotal - childPrice * children.length - infantPrice * infants.length);
      adultPrice = adults.length > 0 ? Math.round(rem / adults.length) : 0;
    }
    store.updateBooking(selected.id, {
      agentId: form.agentId, supplierId: form.supplierId,
      totalAmount: computedTotal, amountReceived: Number(form.amountReceived) || 0,
      totalCost: Number(form.totalCost) || 0, commission: Number(form.commission) || 0,
      packageType: form.packageType, status: form.status, travelDate: form.travelDate,
      destination: form.destination, driveLink: form.driveLink,
    });
    // Override per-category dues and redistribute the payment
    let remaining = Number(form.amountReceived) || 0;
    const ordered = [...adults, ...children, ...infants];
    ordered.forEach((c) => {
      const due = c.ageCategory === "Child" ? childPrice : c.ageCategory === "Infant" ? infantPrice : adultPrice;
      let paid = 0;
      let status: "Paid" | "Partial" | "Unpaid" = "Unpaid";
      if (due <= 0) { paid = 0; status = "Paid"; }
      else if (remaining >= due) { paid = due; remaining -= due; status = "Paid"; }
      else if (remaining > 0) { paid = remaining; remaining = 0; status = "Partial"; }
      store.updateClient(c.id, {
        amountDue: due, amountPaid: paid, paymentStatus: status,
        packageType: form.packageType, destination: form.destination,
      });
    });
    setEditOpen(false);
  }

  function openEdit(b: Booking) {
    const cs = store.clients.filter((c) => c.headId === b.headId);
    const adults = cs.filter((c) => (c.ageCategory || "Adult") === "Adult");
    const children = cs.filter((c) => c.ageCategory === "Child");
    const infants = cs.filter((c) => c.ageCategory === "Infant");
    setSelected(b);
    setForm({
      agentId: b.agentId, supplierId: b.supplierId, totalAmount: String(b.totalAmount),
      amountReceived: String(b.amountReceived), totalCost: String(b.totalCost || 0),
      commission: String(b.commission || 0), packageType: b.packageType, status: b.status,
      travelDate: b.travelDate,
      adults: String(adults.length || b.members || 1),
      children: String(children.length),
      infants: String(infants.length),
      pricingMode: "total",
      adultPrice: String(adults[0]?.amountDue || 0),
      childPrice: String(children[0]?.amountDue || 0),
      infantPrice: String(infants[0]?.amountDue || 0),
      destination: b.destination || "", driveLink: b.driveLink || "",
    });
    setEditOpen(true);
  }

  function downloadInvoice(b: Booking) {
    const clients = store.clients.filter((c) => c.headId === b.headId);
    const agent = store.agents.find((a) => a.id === b.agentId);
    const supplier = store.suppliers.find((s) => s.id === b.supplierId);
    generateInvoice(b, clients, agent, supplier);
  }

  function downloadPaymentHistory(b: Booking) {
    const related = store.entries.filter((e) => e.headId === b.headId && e.type === "client_receive");
    const totalReceived = related.reduce((s, e) => s + e.amount, 0);
    generatePaymentHistory(
      `Booking ${b.headId}`,
      [["Head ID", b.headId], ["Package", b.packageType], ["Travel Date", b.travelDate], ["Members", String(b.members)]],
      related,
      [
        ["Total Amount", formatCurrency(b.totalAmount), "ink"],
        ["Received", formatCurrency(totalReceived), "success"],
        ["Pending", formatCurrency(b.totalAmount - totalReceived), "destructive"],
      ]
    );
  }

  const step1Fields = (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <p className="text-xs text-muted-foreground">Head ID will be auto-generated</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Agent</Label>
          <SearchableSelect
            value={form.agentId}
            onChange={(v) => setForm({ ...form, agentId: v })}
            placeholder="Select Agent or Direct"
            options={[{ value: "Direct", label: "Direct (No Agent)" }, ...store.agents.map((a) => ({ value: a.id, label: `${a.id} — ${a.name}`, hint: a.phone }))]}
            className="mt-1"
          />
        </div>
        <div><Label className="text-xs">Supplier</Label>
          <SearchableSelect
            value={form.supplierId}
            onChange={(v) => setForm({ ...form, supplierId: v })}
            placeholder="Select Supplier"
            options={store.suppliers.map((s) => ({ value: s.id, label: `${s.id} — ${s.companyName}`, hint: s.serviceType }))}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Package Type</Label>
          <Select value={form.packageType} onValueChange={(v) => setForm({ ...form, packageType: v as Booking["packageType"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PACKAGE_TYPES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Booking["status"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div><Label className="text-xs">Travel Date</Label><Input type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Adults</Label><Input type="number" min="0" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Children</Label><Input type="number" min="0" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Infants</Label><Input type="number" min="0" value={form.infants} onChange={(e) => setForm({ ...form, infants: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="rounded-lg border border-border/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Pricing Mode</Label>
          <div className="flex gap-1 rounded-md bg-accent/20 p-0.5">
            <button type="button" onClick={() => setForm({ ...form, pricingMode: "total" })}
              className={`px-3 py-1 text-[11px] rounded ${form.pricingMode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Total Package</button>
            <button type="button" onClick={() => setForm({ ...form, pricingMode: "per_person" })}
              className={`px-3 py-1 text-[11px] rounded ${form.pricingMode === "per_person" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Per Person</button>
          </div>
        </div>
        {form.pricingMode === "total" ? (
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-[10px]">Total Amount</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Child Price (each)</Label><Input type="number" value={form.childPrice} onChange={(e) => setForm({ ...form, childPrice: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Infant Price (each)</Label><Input type="number" value={form.infantPrice} onChange={(e) => setForm({ ...form, infantPrice: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-[10px]">Adult Price (each)</Label><Input type="number" value={form.adultPrice} onChange={(e) => setForm({ ...form, adultPrice: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Child Price (each)</Label><Input type="number" value={form.childPrice} onChange={(e) => setForm({ ...form, childPrice: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Infant Price (each)</Label><Input type="number" value={form.infantPrice} onChange={(e) => setForm({ ...form, infantPrice: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
          </div>
        )}
        {(() => {
          const a = Math.max(0, Number(form.adults) || 0);
          const c = Math.max(0, Number(form.children) || 0);
          const inf = Math.max(0, Number(form.infants) || 0);
          const cp = Number(form.childPrice) || 0;
          const ip = Number(form.infantPrice) || 0;
          let adultEach = 0; let total = 0;
          if (form.pricingMode === "per_person") {
            adultEach = Number(form.adultPrice) || 0;
            total = adultEach * a + cp * c + ip * inf;
          } else {
            total = Number(form.totalAmount) || 0;
            const rem = Math.max(0, total - cp * c - ip * inf);
            adultEach = a > 0 ? Math.round(rem / a) : 0;
          }
          return (
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
              <span>Adult × {a} @ <span className="text-primary">{formatCurrency(adultEach)}</span></span>
              <span>Child × {c} @ <span className="text-primary">{formatCurrency(cp)}</span></span>
              <span>Infant × {inf} @ <span className="text-primary">{formatCurrency(ip)}</span></span>
              <span className="ml-auto font-semibold text-foreground">Total: {formatCurrency(total)}</span>
            </div>
          );
        })()}
        <div><Label className="text-[10px]">Amount Received (PKR)</Label><Input type="number" value={form.amountReceived} onChange={(e) => setForm({ ...form, amountReceived: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Total Cost (PKR)</Label><Input type="number" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Commission (PKR)</Label><Input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Makkah / Madinah" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div><Label className="text-xs">Google Drive Link (optional)</Label><Input value={form.driveLink} onChange={(e) => setForm({ ...form, driveLink: e.target.value })} placeholder="https://drive.google.com/..." className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
    </div>
  );

  const currentMember = memberForms[memberIndex];
  const step2Fields = currentMember ? (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between rounded-lg bg-accent/20 px-3 py-2">
        <p className="text-xs font-semibold text-primary">
          Member {memberIndex + 1} of {memberForms.length} {memberIndex === 0 && "(Head)"}
        </p>
        <div className="flex gap-1">
          {memberForms.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i === memberIndex ? "bg-primary" : i < memberIndex ? "bg-primary/50" : "bg-border"}`} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border/50 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">Type</Label>
            <Select value={currentMember.ageCategory} onValueChange={(v) => updateMember(memberIndex, "ageCategory", v)}>
              <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Adult">Adult</SelectItem><SelectItem value="Child">Child</SelectItem><SelectItem value="Infant">Infant</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Gender</Label>
            <Select value={currentMember.gender} onValueChange={(v) => updateMember(memberIndex, "gender", v)}>
              <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">First Name</Label><Input value={currentMember.firstName} onChange={(e) => updateMember(memberIndex, "firstName", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Last Name</Label><Input value={currentMember.lastName} onChange={(e) => updateMember(memberIndex, "lastName", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">Nationality</Label><Input value={currentMember.nationality} onChange={(e) => updateMember(memberIndex, "nationality", e.target.value)} placeholder={memberIndex > 0 ? "Auto from Member 1" : "e.g. Pakistani"} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Date of Birth</Label><Input type="date" value={currentMember.dateOfBirth} onChange={(e) => updateMember(memberIndex, "dateOfBirth", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">Passport Number</Label><Input value={currentMember.passport} onChange={(e) => updateMember(memberIndex, "passport", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          <div><Label className="text-[10px]">CNIC</Label><Input value={currentMember.cnic} onChange={(e) => updateMember(memberIndex, "cnic", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">Date of Issue</Label><Input type="date" value={currentMember.dateOfIssue} onChange={(e) => updateMember(memberIndex, "dateOfIssue", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Date of Expire</Label><Input type="date" value={currentMember.dateOfExpire} onChange={(e) => updateMember(memberIndex, "dateOfExpire", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">Contact</Label><Input value={currentMember.phone} onChange={(e) => updateMember(memberIndex, "phone", e.target.value)} placeholder={memberIndex > 0 ? "Auto from Member 1" : ""} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Email</Label><Input value={currentMember.email} onChange={(e) => updateMember(memberIndex, "email", e.target.value)} placeholder={memberIndex > 0 ? "Auto from Member 1" : ""} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
        </div>
      </div>
    </div>
  ) : null;

  // Edit reuses the same "Step 1" layout as create so bookings edit exactly like they were entered.
  const editFormFields = step1Fields;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings (Head IDs)"
        subtitle="Master booking management"
        actions={
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" /> New Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-xl">
              <DialogHeader>
                <DialogTitle>
                  {step === 1 ? "Step 1: Booking Details" : "Step 2: Member Details"}
                  <span className="ml-2 text-xs text-muted-foreground">(Head ID: Auto-generated)</span>
                </DialogTitle>
              </DialogHeader>
              {step === 1 ? step1Fields : step2Fields}
              <div className="flex gap-2">
                {step === 1 ? (
                  <Button onClick={goToStep2} className="w-full">Next → Member Details</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => {
                      if (memberIndex === 0) setStep(1);
                      else setMemberIndex(memberIndex - 1);
                    }} className="flex-1">
                      {memberIndex === 0 ? "← Booking Details" : "← Previous Member"}
                    </Button>
                    {memberIndex < memberForms.length - 1 ? (
                      <Button onClick={() => setMemberIndex(memberIndex + 1)} className="flex-1">Next Member →</Button>
                    ) : (
                      <Button onClick={handleAdd} className="flex-1">Create Booking</Button>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Head ID</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Members</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{b.agentId || "Direct"}</td>
                    <td className="px-4 py-3">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-success">{formatCurrency(b.amountReceived)}</td>
                    <td className="px-4 py-3 text-destructive">{formatCurrency(pending)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{b.travelDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link to="/payments" className="rounded p-1 hover:bg-accent"><Eye className="h-3.5 w-3.5 text-primary" /></Link>
                        <button onClick={() => downloadInvoice(b)} className="rounded p-1 hover:bg-accent" title="Download Invoice"><FileText className="h-3.5 w-3.5 text-success" /></button>
                        <button onClick={() => downloadPaymentHistory(b)} className="rounded p-1 hover:bg-accent" title="Payment History PDF"><Download className="h-3.5 w-3.5 text-warning" /></button>
                        <BookingServicesMenu booking={b} clients={clients} />
                        <VoucherDownloadMenu booking={b} clients={clients} />
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
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Supplier: {b.supplierId} | Destination: {b.destination || "—"}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => {
                    const head = store.clients.find((c) => c.headId === b.headId);
                    setMemberEdit({
                      id: "",
                      headId: b.headId,
                      firstName: "",
                      lastName: "",
                      gender: "Male",
                      ageCategory: "Adult",
                      nationality: head?.nationality || "",
                      passport: "",
                      cnic: "",
                      dateOfBirth: "",
                      dateOfIssue: "",
                      dateOfExpire: "",
                      phone: head?.phone || "",
                      email: head?.email || "",
                      packageType: b.packageType,
                      paymentStatus: "Unpaid",
                      amountDue: 0,
                      amountPaid: 0,
                      isVip: false,
                      destination: b.destination,
                    } as Client);
                    setMemberEditOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" /> Add Member
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setMemberEdit({ ...c }); setMemberEditOpen(true); }}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/30 hover:border-primary/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{getClientName(c)}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                        c.ageCategory === "Child" ? "bg-warning/20 text-warning" :
                        c.ageCategory === "Infant" ? "bg-blue-500/20 text-blue-400" :
                        "bg-primary/20 text-primary"
                      }`}>{c.ageCategory || "Adult"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.id} · {c.passport || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{formatCurrency(c.amountPaid)} / {formatCurrency(c.amountDue)}</p>
                    <StatusBadge status={c.paymentStatus} />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        );
      })}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader><DialogTitle>Edit Booking — {selected?.headId}</DialogTitle></DialogHeader>
          {editFormFields}
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={memberEditOpen} onOpenChange={setMemberEditOpen}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {memberEdit && !memberEdit.id ? "Add New Member" : "Edit Member"}
              {memberEdit && memberEdit.id ? ` — ${getClientName(memberEdit)}` : ""}
              {memberEdit && memberEdit.id && <span className="ml-2 text-xs text-muted-foreground">{memberEdit.id}</span>}
            </DialogTitle>
          </DialogHeader>
          {memberEdit && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Type</Label>
                  <Select value={memberEdit.ageCategory || "Adult"} onValueChange={(v) => setMemberEdit({ ...memberEdit, ageCategory: v as Client["ageCategory"] })}>
                    <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Adult">Adult</SelectItem><SelectItem value="Child">Child</SelectItem><SelectItem value="Infant">Infant</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-[10px]">Gender</Label>
                  <Select value={memberEdit.gender} onValueChange={(v) => setMemberEdit({ ...memberEdit, gender: v as Client["gender"] })}>
                    <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">First Name</Label><Input value={memberEdit.firstName} onChange={(e) => setMemberEdit({ ...memberEdit, firstName: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-[10px]">Last Name</Label><Input value={memberEdit.lastName} onChange={(e) => setMemberEdit({ ...memberEdit, lastName: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Nationality</Label><Input value={memberEdit.nationality} onChange={(e) => setMemberEdit({ ...memberEdit, nationality: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-[10px]">Date of Birth</Label><Input type="date" value={memberEdit.dateOfBirth || ""} onChange={(e) => setMemberEdit({ ...memberEdit, dateOfBirth: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Passport</Label><Input value={memberEdit.passport} onChange={(e) => setMemberEdit({ ...memberEdit, passport: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-[10px]">CNIC</Label><Input value={memberEdit.cnic || ""} onChange={(e) => setMemberEdit({ ...memberEdit, cnic: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Date of Issue</Label><Input type="date" value={memberEdit.dateOfIssue || ""} onChange={(e) => setMemberEdit({ ...memberEdit, dateOfIssue: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-[10px]">Date of Expire</Label><Input type="date" value={memberEdit.dateOfExpire || ""} onChange={(e) => setMemberEdit({ ...memberEdit, dateOfExpire: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Contact</Label><Input value={memberEdit.phone} onChange={(e) => setMemberEdit({ ...memberEdit, phone: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-[10px]">Email</Label><Input value={memberEdit.email || ""} onChange={(e) => setMemberEdit({ ...memberEdit, email: e.target.value })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Amount Due</Label><Input type="number" value={memberEdit.amountDue} onChange={(e) => setMemberEdit({ ...memberEdit, amountDue: Number(e.target.value) || 0 })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-[10px]">Amount Paid</Label><Input type="number" value={memberEdit.amountPaid} onChange={(e) => setMemberEdit({ ...memberEdit, amountPaid: Number(e.target.value) || 0 })} className="bg-accent/20 border-border mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="flex items-center gap-2">
                <input id="vip" type="checkbox" checked={memberEdit.isVip} onChange={(e) => setMemberEdit({ ...memberEdit, isVip: e.target.checked })} />
                <Label htmlFor="vip" className="text-xs">Mark as VIP</Label>
              </div>
            </div>
          )}
          <Button onClick={() => {
            if (!memberEdit) return;
            const paid = memberEdit.amountPaid;
            const due = memberEdit.amountDue;
            const status: "Paid" | "Partial" | "Unpaid" = paid >= due && due > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
            if (!memberEdit.id) {
              // New member — create client and attach to booking
              const { id: _omit, ...rest } = memberEdit;
              void _omit;
              const newId = store.addClient({ ...rest, paymentStatus: status });
              const booking = store.bookings.find((bk) => bk.headId === memberEdit.headId);
              if (booking) {
                store.updateBooking(booking.id, {
                  clientIds: [...booking.clientIds, newId],
                  members: (booking.members || booking.clientIds.length) + 1,
                });
              }
            } else {
              store.updateClient(memberEdit.id, { ...memberEdit, paymentStatus: status });
            }
            setMemberEditOpen(false);
          }} className="w-full">Save Member</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
