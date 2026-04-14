import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { mockSuppliers, formatCurrency } from "@/lib/data";

export const Route = createFileRoute("/suppliers")({
  component: SuppliersPage,
  head: () => ({ meta: [{ title: "Suppliers — AV Travel CRM" }] }),
});

function SuppliersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Management"
        subtitle={`${mockSuppliers.length} suppliers`}
        actions={<Button className="gap-2"><Plus className="h-4 w-4" /> Add Supplier</Button>}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Supplier ID</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Total Payable</th>
                <th className="px-4 py-3">Total Paid</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockSuppliers.map((s) => {
                const remaining = s.totalPayable - s.totalPaid;
                const status = remaining === 0 ? "Paid" : remaining < s.totalPayable ? "Partial" : "Unpaid";
                return (
                  <tr key={s.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3 font-semibold text-primary">{s.id}</td>
                    <td className="px-4 py-3 font-medium">{s.companyName}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{s.contactPerson}</p>
                      <p className="text-xs text-muted-foreground">{s.phone}</p>
                    </td>
                    <td className="px-4 py-3">{s.serviceType}</td>
                    <td className="px-4 py-3">{formatCurrency(s.totalPayable)}</td>
                    <td className="px-4 py-3 text-success">{formatCurrency(s.totalPaid)}</td>
                    <td className="px-4 py-3 text-destructive">{formatCurrency(remaining)}</td>
                    <td className="px-4 py-3"><StatusBadge status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Supplier Ledger Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {mockSuppliers.map((s, i) => {
          const remaining = s.totalPayable - s.totalPaid;
          const paidPercent = Math.round((s.totalPaid / s.totalPayable) * 100);
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card rounded-xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{s.companyName}</h3>
                <span className="text-xs text-muted-foreground">{s.id}</span>
              </div>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-accent/30">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${paidPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid: {formatCurrency(s.totalPaid)}</span>
                <span>Remaining: {formatCurrency(remaining)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
