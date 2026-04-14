import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { mockBookings, mockClients, formatCurrency } from "@/lib/data";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Bookings — AV Travel CRM" }] }),
});

function BookingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings (Head IDs)"
        subtitle="Master booking management"
        actions={<Button className="gap-2"><Plus className="h-4 w-4" /> New Booking</Button>}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Head ID</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Pending</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Travel Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockBookings.map((b) => {
                const pending = b.totalAmount - b.amountReceived;
                const clients = mockClients.filter((c) => c.headId === b.headId);
                return (
                  <tr key={b.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3 font-semibold text-primary">{b.headId}</td>
                    <td className="px-4 py-3">{b.packageType}</td>
                    <td className="px-4 py-3">{clients.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.agentId}</td>
                    <td className="px-4 py-3">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3 text-success">{formatCurrency(b.amountReceived)}</td>
                    <td className="px-4 py-3 text-destructive">{formatCurrency(pending)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{b.travelDate}</td>
                    <td className="px-4 py-3">
                      <Link to="/payments" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <Eye className="h-3 w-3" /> View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Client breakdown per booking */}
      {mockBookings.map((b) => {
        const clients = mockClients.filter((c) => c.headId === b.headId);
        return (
          <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                <span className="text-primary">{b.headId}</span> — Clients ({clients.length})
              </h3>
              <span className="text-xs text-muted-foreground">Supplier: {b.supplierId}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-accent/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.id} · {c.passport}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatCurrency(c.amountPaid)} / {formatCurrency(c.amountDue)}</p>
                    <StatusBadge status={c.paymentStatus} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
