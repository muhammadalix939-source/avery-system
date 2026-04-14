import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { mockClients, formatCurrency } from "@/lib/data";
import { useState } from "react";

export const Route = createFileRoute("/clients")({
  component: ClientsPage,
  head: () => ({ meta: [{ title: "Clients — AV Travel CRM" }] }),
});

function ClientsPage() {
  const [filter, setFilter] = useState<string>("All");
  const filtered = filter === "All" ? mockClients : mockClients.filter((c) => c.paymentStatus === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Management"
        subtitle={`${mockClients.length} total clients`}
        actions={<Button className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["All", "Paid", "Partial", "Unpaid"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Client ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Head ID</th>
                <th className="px-4 py-3">Passport</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">VIP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-semibold text-primary">{c.id}</td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.headId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.passport}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.packageType}</td>
                  <td className="px-4 py-3 text-success">{formatCurrency(c.amountPaid)}</td>
                  <td className="px-4 py-3 text-destructive">{formatCurrency(c.amountDue - c.amountPaid)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.paymentStatus} /></td>
                  <td className="px-4 py-3">{c.isVip && <span className="text-xs text-primary">⭐ VIP</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
