import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/data";
import type { Client, Booking, Agent, Supplier } from "@/lib/data";
import type { LedgerEntry } from "@/lib/store";

interface DetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "client" | "agent" | "supplier" | "booking";
  data: Client | Agent | Supplier | Booking | null;
  entries?: LedgerEntry[];
}

export default function DetailDialog({ open, onOpenChange, type, data, entries = [] }: DetailDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary">
            {type === "client" && `Client: ${(data as Client).name}`}
            {type === "agent" && `Agent: ${(data as Agent).name}`}
            {type === "supplier" && `Supplier: ${(data as Supplier).companyName}`}
            {type === "booking" && `Booking: ${(data as Booking).headId}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {type === "client" && renderClient(data as Client)}
          {type === "agent" && renderAgent(data as Agent)}
          {type === "supplier" && renderSupplier(data as Supplier)}
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

function renderClient(c: Client) {
  return (
    <>
      <Row label="Client ID" value={c.id} />
      <Row label="Head ID" value={c.headId} />
      <Row label="Name" value={c.name} />
      <Row label="Passport" value={c.passport} />
      <Row label="Phone" value={c.phone} />
      <Row label="Package" value={c.packageType} />
      <Row label="Amount Due" value={formatCurrency(c.amountDue)} />
      <Row label="Amount Paid" value={formatCurrency(c.amountPaid)} color="text-success" />
      <Row label="Remaining" value={formatCurrency(c.amountDue - c.amountPaid)} color="text-destructive" />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={c.paymentStatus} />
      </div>
      <Row label="VIP" value={c.isVip ? "⭐ Yes" : "No"} />
    </>
  );
}

function renderAgent(a: Agent) {
  return (
    <>
      <Row label="Agent ID" value={a.id} />
      <Row label="Name" value={a.name} />
      <Row label="Phone" value={a.phone} />
      <Row label="Email" value={a.email} />
      <Row label="Total Sales" value={formatCurrency(a.totalSales)} color="text-primary" />
      <Row label="Total Clients" value={String(a.totalClients)} />
      <Row label="Commission" value={formatCurrency(a.commission)} color="text-success" />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={a.status} />
      </div>
    </>
  );
}

function renderSupplier(s: Supplier) {
  const remaining = s.totalPayable - s.totalPaid;
  return (
    <>
      <Row label="Supplier ID" value={s.id} />
      <Row label="Company" value={s.companyName} />
      <Row label="Contact" value={s.contactPerson} />
      <Row label="Phone" value={s.phone} />
      <Row label="Email" value={s.email} />
      <Row label="Service Type" value={s.serviceType} />
      <Row label="Total Payable" value={formatCurrency(s.totalPayable)} />
      <Row label="Total Paid" value={formatCurrency(s.totalPaid)} color="text-success" />
      <Row label="Remaining" value={formatCurrency(remaining)} color="text-destructive" />
    </>
  );
}

function renderBooking(b: Booking) {
  return (
    <>
      <Row label="Booking ID" value={b.id} />
      <Row label="Head ID" value={b.headId} />
      <Row label="Package" value={b.packageType} />
      <Row label="Agent" value={b.agentId} />
      <Row label="Supplier" value={b.supplierId} />
      <Row label="Total Amount" value={formatCurrency(b.totalAmount)} />
      <Row label="Received" value={formatCurrency(b.amountReceived)} color="text-success" />
      <Row label="Pending" value={formatCurrency(b.totalAmount - b.amountReceived)} color="text-destructive" />
      <div className="flex justify-between border-b border-border/30 py-2">
        <span className="text-muted-foreground">Status</span>
        <StatusBadge status={b.status} />
      </div>
      <Row label="Travel Date" value={b.travelDate} />
      <Row label="Created" value={b.createdAt} />
      <Row label="Clients" value={`${b.clientIds.length} members`} />
    </>
  );
}
