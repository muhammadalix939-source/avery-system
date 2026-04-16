import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Eye, Trash2, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, getClientName, type Booking } from "@/lib/data";
import { useStore } from "@/lib/store";
import { getPKTDate } from "@/lib/date-utils";
import { generateInvoice } from "@/lib/pdf";
import { useState } from "react";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Bookings — AV Travel CRM" }] }),
});

interface MemberForm {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Custom";
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
  firstName: "", lastName: "", gender: "Male", nationality: "", passport: "", cnic: "",
  dateOfBirth: "", dateOfIssue: "", dateOfExpire: "", phone: "", email: "",
};

function BookingsPage() {
  const store = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    agentId: "", supplierId: "", totalAmount: "", amountReceived: "", totalCost: "", commission: "",
    packageType: "Umrah" as Booking["packageType"], status: "Pending" as Booking["status"],
    travelDate: "", members: "1", destination: "", driveLink: "",
  });

  const [memberForms, setMemberForms] = useState<MemberForm[]>([]);

  function resetForm() {
    setForm({ agentId: "", supplierId: "", totalAmount: "", amountReceived: "", totalCost: "", commission: "", packageType: "Umrah", status: "Pending", travelDate: "", members: "1", destination: "", driveLink: "" });
    setMemberForms([]);
    setStep(1);
  }

  function goToStep2() {
    const count = Math.max(1, Number(form.members) || 1);
    const existing = [...memberForms];
    while (existing.length < count) existing.push({ ...emptyMember });
    setMemberForms(existing.slice(0, count));
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
    const bookingId = store.addBooking({
      headId, agentId: form.agentId, supplierId: form.supplierId,
      totalAmount: Number(form.totalAmount) || 0, amountReceived: Number(form.amountReceived) || 0,
      totalCost: Number(form.totalCost) || 0, commission: Number(form.commission) || 0,
      clientIds: [], status: form.status, packageType: form.packageType, travelDate: form.travelDate,
      createdAt: today, members: memberForms.length,
      destination: form.destination, driveLink: form.driveLink,
    });

    const perPerson = memberForms.length > 0 ? Math.round((Number(form.totalAmount) || 0) / memberForms.length) : 0;
    const clientIds: string[] = [];
    memberForms.forEach((m, i) => {
      const cid = store.addClient({
        headId,
        firstName: m.firstName || `Member`,
        lastName: m.lastName || `${i + 1}`,
        gender: m.gender,
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
        amountDue: perPerson,
        amountPaid: 0,
        isVip: false,
        destination: form.destination,
        driveLink: form.driveLink,
      });
      clientIds.push(cid);
    });

    store.updateBooking(bookingId, { clientIds });

    if (Number(form.amountReceived) > 0) {
      store.addEntry({
        date: today, type: "client_receive", headId, referenceId: headId,
        referenceName: `Booking ${headId}`, amount: Number(form.amountReceived),
        note: `Initial payment for ${headId}`,
      });
    }

    resetForm();
    setAddOpen(false);
  }

  function handleEdit() {
    if (!selected) return;
    store.updateBooking(selected.id, {
      agentId: form.agentId, supplierId: form.supplierId,
      totalAmount: Number(form.totalAmount) || 0, amountReceived: Number(form.amountReceived) || 0,
      totalCost: Number(form.totalCost) || 0, commission: Number(form.commission) || 0,
      packageType: form.packageType, status: form.status, travelDate: form.travelDate,
      destination: form.destination, driveLink: form.driveLink,
    });
    setEditOpen(false);
  }

  function openEdit(b: Booking) {
    setSelected(b);
    setForm({
      agentId: b.agentId, supplierId: b.supplierId, totalAmount: String(b.totalAmount),
      amountReceived: String(b.amountReceived), totalCost: String(b.totalCost || 0),
      commission: String(b.commission || 0), packageType: b.packageType, status: b.status,
      travelDate: b.travelDate, members: String(b.members || b.clientIds.length),
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

  const step1Fields = (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <p className="text-xs text-muted-foreground">Head ID will be auto-generated</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Agent ID / Direct</Label><Input value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} placeholder="AV-A001 or Direct" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Supplier ID</Label><Input value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} placeholder="AV-S001" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Package Type</Label>
          <Select value={form.packageType} onValueChange={(v) => setForm({ ...form, packageType: v as Booking["packageType"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Umrah">Umrah</SelectItem><SelectItem value="Hajj">Hajj</SelectItem><SelectItem value="Tour">Tour</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Booking["status"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Total Amount (PKR)</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Amount Received (PKR)</Label><Input type="number" value={form.amountReceived} onChange={(e) => setForm({ ...form, amountReceived: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Total Cost (PKR)</Label><Input type="number" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Commission (PKR)</Label><Input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Travel Date</Label><Input type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Number of Members</Label><Input type="number" min="1" value={form.members} onChange={(e) => setForm({ ...form, members: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Makkah / Madinah" className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      <div><Label className="text-xs">Google Drive Link (optional)</Label><Input value={form.driveLink} onChange={(e) => setForm({ ...form, driveLink: e.target.value })} placeholder="https://drive.google.com/..." className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
    </div>
  );

  const step2Fields = (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
      <p className="text-xs text-muted-foreground">Member 1's nationality, phone & email auto-fill to all members. Override individually if needed.</p>
      {memberForms.map((m, i) => (
        <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Member {i + 1} {i === 0 && "(Head)"}</p>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-[10px]">First Name</Label><Input value={m.firstName} onChange={(e) => updateMember(i, "firstName", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
            <div><Label className="text-[10px]">Last Name</Label><Input value={m.lastName} onChange={(e) => updateMember(i, "lastName", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
            <div><Label className="text-[10px]">Gender</Label>
              <Select value={m.gender} onValueChange={(v) => updateMember(i, "gender", v)}>
                <SelectTrigger className="bg-accent/20 border-border mt-0.5 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Nationality</Label><Input value={m.nationality} onChange={(e) => updateMember(i, "nationality", e.target.value)} placeholder={i > 0 ? "Auto from Member 1" : "e.g. Pakistani"} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
            <div><Label className="text-[10px]">Date of Birth</Label><Input type="date" value={m.dateOfBirth} onChange={(e) => updateMember(i, "dateOfBirth", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Passport Number</Label><Input value={m.passport} onChange={(e) => updateMember(i, "passport", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
            <div><Label className="text-[10px]">CNIC</Label><Input value={m.cnic} onChange={(e) => updateMember(i, "cnic", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Date of Issue</Label><Input type="date" value={m.dateOfIssue} onChange={(e) => updateMember(i, "dateOfIssue", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
            <div><Label className="text-[10px]">Date of Expire</Label><Input type="date" value={m.dateOfExpire} onChange={(e) => updateMember(i, "dateOfExpire", e.target.value)} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Contact</Label><Input value={m.phone} onChange={(e) => updateMember(i, "phone", e.target.value)} placeholder={i > 0 ? "Auto from Member 1" : ""} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
            <div><Label className="text-[10px]">Email</Label><Input value={m.email} onChange={(e) => updateMember(i, "email", e.target.value)} placeholder={i > 0 ? "Auto from Member 1" : ""} className="bg-accent/20 border-border mt-0.5 h-7 text-xs" /></div>
          </div>
        </div>
      ))}
    </div>
  );

  const editFormFields = (
    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Agent ID</Label><Input value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Supplier ID</Label><Input value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Package</Label>
          <Select value={form.packageType} onValueChange={(v) => setForm({ ...form, packageType: v as Booking["packageType"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Umrah">Umrah</SelectItem><SelectItem value="Hajj">Hajj</SelectItem><SelectItem value="Tour">Tour</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Booking["status"] })}>
            <SelectTrigger className="bg-accent/20 border-border mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Total Amount</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Amount Received</Label><Input type="number" value={form.amountReceived} onChange={(e) => setForm({ ...form, amountReceived: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Total Cost</Label><Input type="number" value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Commission</Label><Input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Travel Date</Label><Input type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
        <div><Label className="text-xs">Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Drive Link</Label><Input value={form.driveLink} onChange={(e) => setForm({ ...form, driveLink: e.target.value })} className="bg-accent/20 border-border mt-1 h-8 text-xs" /></div>
    </div>
  );

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
                {step === 2 && <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>}
                {step === 1 ? (
                  <Button onClick={goToStep2} className="w-full">Next → Member Details</Button>
                ) : (
                  <Button onClick={handleAdd} className="flex-1">Create Booking</Button>
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
                        <button onClick={() => downloadInvoice(b)} className="rounded p-1 hover:bg-accent" title="Download Invoice"><Download className="h-3.5 w-3.5 text-success" /></button>
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
              <span className="text-xs text-muted-foreground">Supplier: {b.supplierId} | Destination: {b.destination || "—"}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-accent/10 px-4 py-3">
                  <div><p className="text-sm font-medium">{getClientName(c)}</p><p className="text-xs text-muted-foreground">{c.id} · {c.passport}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">{formatCurrency(c.amountPaid)} / {formatCurrency(c.amountDue)}</p><StatusBadge status={c.paymentStatus} /></div>
                </div>
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
    </div>
  );
}
