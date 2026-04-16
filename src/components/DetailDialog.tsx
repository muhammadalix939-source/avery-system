import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ChevronRight, ArrowLeft, Users, DollarSign } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, getClientName } from "@/lib/data";
import type { Client, Booking, Agent, Supplier } from "@/lib/data";
import type { LedgerEntry } from "@/lib/store";
import { generateClientStatement, generateSupplierLedger, generateAgentReport } from "@/lib/pdf";
import { useState } from "react";

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "client" | "agent" | "supplier" | "booking";
  data: Client | Agent | Supplier | Booking | null;
  entries?: LedgerEntry[];
  allClients?: Client[];
  allBookings?: Booking[];
}

export default function DetailDialog({ open, onOpenChange, type, data, entries = [], allClients = [], allBookings = [] }: DetailDialogProps) {
  const [subView, setSubView] = useState<"main" | "clients" | "client-detail" | "bookings">("main");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  if (!data) return null;

  function handleClose(o: boolean) {
    if (!o) { setSubView("main"); setSelectedClient(null); }
    onOpenChange(o);
  }

  function handleDownload() {
    if (!data) return;
    if (type === "client") generateClientStatement(data as Client, entries);
    if (type === "supplier") generateSupplierLedger(data as Supplier, entries);
    if (type === "agent") generateAgentReport(data as Agent, entries);
  }

  // Compute agent stats from bookings
  function getAgentStats(a: Agent) {
    const agentBookings = allBookings.filter((b) => b.agentId === a.id);
    const agentClients = allClients.filter((c) => agentBookings.some((b) => b.headId === c.headId));
    const totalSales = agentBookings.reduce((s, b) => s + b.totalAmount, 0);
    const totalCommission = agentBookings.reduce((s, b) => s + (b.commission || 0), 0);
    const paidCommission = entries.filter((e) => e.type === "agent_commission" && e.referenceId === a.id).reduce((s, e) => s + e.amount, 0);
    return { agentBookings, agentClients, totalSales, totalCommission, paidCommission, payable: totalCommission - paidCommission };
  }

  // Compute supplier stats from bookings
  function getSupplierStats(s: Supplier) {
    const supplierBookings = allBookings.filter((b) => b.supplierId === s.id);
    const totalCost = supplierBookings.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const totalPaid = entries.filter((e) => e.type === "supplier_payment" && e.referenceId === s.id).reduce((sum, e) => sum + e.amount, 0);
    return { supplierBookings, totalCost, totalPaid, remaining: totalCost - totalPaid };
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-card border-border max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            {subView !== "main" && (
              <Button size="sm" variant="ghost" onClick={() => { setSubView("main"); setSelectedClient(null); }} className="gap-1 text-xs px-2">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            <DialogTitle className="text-primary text-sm flex-1">
              {subView === "client-detail" && selectedClient ? `${getClientName(selectedClient)}` :
               subView === "clients" && type === "agent" ? `Clients of ${(data as Agent).name}` :
               subView === "bookings" && type === "supplier" ? `Bookings — ${(data as Supplier).companyName}` :
               type === "client" ? `Client: ${getClientName(data as Client)}` :
               type === "agent" ? `Agent: ${(data as Agent).name}` :
               type === "supplier" ? `Supplier: ${(data as Supplier).companyName}` :
               `Booking: ${(data as Booking).headId}`}
            </DialogTitle>
            {type !== "booking" && subView === "main" && (
              <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* MAIN VIEW */}
          {subView === "main" && (
            <>
              {type === "client" && renderClient(data as Client)}
              {type === "agent" && renderAgentFull(data as Agent, getAgentStats(data as Agent), () => setSubView("clients"))}
              {type === "supplier" && renderSupplierFull(data as Supplier, getSupplierStats(data as Supplier), () => setSubView("bookings"))}
              {type === "booking" && renderBooking(data as Booking)}

              {entries.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Transaction History</h4>
                  <div className="space-y-2">
                    {entries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg bg-accent/20 px-3 py-2 text-xs">
                        <div>
                          <p className="font-medium">{e.note || e.type}</p>
                          <p className="text-muted-foreground">{e.date}</p>
                        </div>
                        <span className={e.type === "client_receive" ? "text-success" : "text-destructive"}>
                          {e.type === "client_receive" ? "+" : "-"}{formatCurrency(e.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* AGENT → CLIENTS LIST */}
          {subView === "clients" && type === "agent" && (() => {
            const stats = getAgentStats(data as Agent);
            const grouped = new Map<string, Client[]>();
            stats.agentClients.forEach((c) => {
              if (!grouped.has(c.headId)) grouped.set(c.headId, []);
              grouped.get(c.headId)!.push(c);
            });
            return (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{stats.agentClients.length} total clients across {grouped.size} bookings</p>
                {Array.from(grouped.entries()).map(([headId, members]) => {
                  const booking = allBookings.find((b) => b.headId === headId);
                  const totalPaid = members.reduce((s, c) => s + c.amountPaid, 0);
                  const totalDue = members.reduce((s, c) => s + c.amountDue, 0);
                  return (
                    <div key={headId} className="rounded-lg border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-primary">{headId}</p>
                          <p className="text-[10px] text-muted-foreground">{members.length} members · {booking?.packageType || ""} · {booking?.destination || ""}</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p>Total: {formatCurrency(booking?.totalAmount || totalDue)}</p>
                          <p className="text-success">Paid: {formatCurrency(totalPaid)}</p>
                        </div>
                      </div>
                      {members.map((c) => (
                        <div key={c.id} onClick={() => { setSelectedClient(c); setSubView("client-detail"); }}
                          className="flex items-center justify-between rounded bg-accent/20 px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors">
                          <div>
                            <p className="text-xs font-medium">{getClientName(c)}</p>
                            <p className="text-[10px] text-muted-foreground">{c.id} · {c.passport}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={c.paymentStatus} />
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* SUPPLIER → BOOKINGS LIST */}
          {subView === "bookings" && type === "supplier" && (() => {
            const stats = getSupplierStats(data as Supplier);
            return (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{stats.supplierBookings.length} bookings</p>
                {stats.supplierBookings.map((b) => {
                  const members = allClients.filter((c) => c.headId === b.headId);
                  return (
                    <div key={b.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-primary">{b.headId}</p>
                          <p className="text-[10px] text-muted-foreground">{b.packageType} · {b.destination || ""} · {b.members} members</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p>Cost: {formatCurrency(b.totalCost || 0)}</p>
                          <p>Amount: {formatCurrency(b.totalAmount)}</p>
                        </div>
                      </div>
                      {members.slice(0, 3).map((c) => (
                        <div key={c.id} onClick={() => { setSelectedClient(c); setSubView("client-detail"); }}
                          className="flex items-center justify-between rounded bg-accent/20 px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors text-xs">
                          <span>{getClientName(c)} — {c.id}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ))}
                      {members.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{members.length - 3} more</p>}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* CLIENT DETAIL (from agent/supplier drill-down) */}
          {subView === "client-detail" && selectedClient && renderClient(selectedClient)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between border-b border-border/30 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color || ""}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-accent/20 p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${color || ""}`}>{value}</p>
    </div>
  );
}

function renderClient(c: Client) {
  return (
    <>
      <Row label="Client ID" value={c.id} />
      <Row label="Head ID" value={c.headId} />
      <Row label="First Name" value={c.firstName} />
      <Row label="Last Name" value={c.lastName} />
      <Row label="Gender" value={c.gender} />
      {c.nationality && <Row label="Nationality" value={c.nationality} />}
      <Row label="Passport" value={c.passport} />
      {c.cnic && <Row label="CNIC" value={c.cnic} />}
      {c.dateOfBirth && <Row label="Date of Birth" value={c.dateOfBirth} />}
      {c.dateOfIssue && <Row label="Date of Issue" value={c.dateOfIssue} />}
      {c.dateOfExpire && <Row label="Date of Expire" value={c.dateOfExpire} />}
      <Row label="Phone" value={c.phone} />
      {c.email && <Row label="Email" value={c.email} />}
      <Row label="Package" value={c.packageType} />
      {c.destination && <Row label="Destination" value={c.destination} />}
      <Row label="Amount Due" value={formatCurrency(c.amountDue)} />
      <Row label="Amount Paid" value={formatCurrency(c.amountPaid)} color="text-success" />
      <Row label="Remaining" value={formatCurrency(c.amountDue - c.amountPaid)} color="text-destructive" />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={c.paymentStatus} />
      </div>
      <Row label="VIP" value={c.isVip ? "⭐ Yes" : "No"} />
      {c.driveLink && <Row label="Drive Link" value={c.driveLink} />}
    </>
  );
}

function renderAgentFull(a: Agent, stats: { agentBookings: any[]; agentClients: Client[]; totalSales: number; totalCommission: number; paidCommission: number; payable: number }, onViewClients: () => void) {
  return (
    <>
      <Row label="Agent ID" value={a.id} />
      <Row label="Name" value={a.name} />
      <Row label="Phone" value={a.phone} />
      <Row label="Email" value={a.email} />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={a.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2">
        <StatCard label="Total Sales" value={formatCurrency(stats.totalSales)} color="text-primary" />
        <StatCard label="Total Clients" value={String(stats.agentClients.length)} />
        <StatCard label="Bookings" value={String(stats.agentBookings.length)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total Commission" value={formatCurrency(stats.totalCommission)} color="text-warning" />
        <StatCard label="Paid Commission" value={formatCurrency(stats.paidCommission)} color="text-success" />
        <StatCard label="Payable" value={formatCurrency(stats.payable)} color="text-destructive" />
      </div>

      <Button onClick={onViewClients} variant="outline" className="w-full gap-2 text-xs">
        <Users className="h-3.5 w-3.5" /> View All Clients ({stats.agentClients.length}) <ChevronRight className="h-3.5 w-3.5 ml-auto" />
      </Button>
    </>
  );
}

function renderSupplierFull(s: Supplier, stats: { supplierBookings: any[]; totalCost: number; totalPaid: number; remaining: number }, onViewBookings: () => void) {
  return (
    <>
      <Row label="Supplier ID" value={s.id} />
      <Row label="Company" value={s.companyName} />
      <Row label="Contact" value={s.contactPerson} />
      <Row label="Phone" value={s.phone} />
      <Row label="Email" value={s.email} />
      <Row label="Service Type" value={s.serviceType} />

      <div className="grid grid-cols-3 gap-2 pt-2">
        <StatCard label="Total Cost" value={formatCurrency(stats.totalCost)} color="text-primary" />
        <StatCard label="Total Paid" value={formatCurrency(stats.totalPaid)} color="text-success" />
        <StatCard label="Remaining" value={formatCurrency(stats.remaining)} color="text-destructive" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Bookings" value={String(stats.supplierBookings.length)} />
        <StatCard label="Payment %" value={stats.totalCost > 0 ? `${Math.round((stats.totalPaid / stats.totalCost) * 100)}%` : "0%"} />
      </div>

      <Button onClick={onViewBookings} variant="outline" className="w-full gap-2 text-xs">
        <DollarSign className="h-3.5 w-3.5" /> View All Bookings ({stats.supplierBookings.length}) <ChevronRight className="h-3.5 w-3.5 ml-auto" />
      </Button>
    </>
  );
}

function renderBooking(b: Booking) {
  return (
    <>
      <Row label="Booking ID" value={b.id} />
      <Row label="Head ID" value={b.headId} />
      <Row label="Package" value={b.packageType} />
      <Row label="Agent" value={b.agentId || "Direct"} />
      <Row label="Supplier" value={b.supplierId} />
      {b.destination && <Row label="Destination" value={b.destination} />}
      <Row label="Members" value={String(b.members || b.clientIds.length)} />
      <Row label="Total Amount" value={formatCurrency(b.totalAmount)} />
      <Row label="Received" value={formatCurrency(b.amountReceived)} color="text-success" />
      <Row label="Pending" value={formatCurrency(b.totalAmount - b.amountReceived)} color="text-destructive" />
      <Row label="Total Cost" value={formatCurrency(b.totalCost || 0)} />
      <Row label="Commission" value={formatCurrency(b.commission || 0)} />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={b.status} />
      </div>
      <Row label="Travel Date" value={b.travelDate} />
      <Row label="Created" value={b.createdAt} />
      {b.driveLink && <Row label="Drive Link" value={b.driveLink} />}
    </>
  );
}
