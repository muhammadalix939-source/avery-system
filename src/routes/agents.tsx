import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { mockAgents, formatCurrency } from "@/lib/data";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
  head: () => ({ meta: [{ title: "Agents — AV Travel CRM" }] }),
});

function AgentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Management"
        subtitle={`${mockAgents.length} active agents`}
        actions={<Button className="gap-2"><Plus className="h-4 w-4" /> Add Agent</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockAgents.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card glass-card-hover rounded-xl p-5 transition-all duration-300"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {a.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <StatusBadge status={a.status} />
            </div>
            <h3 className="text-lg font-semibold">{a.name}</h3>
            <p className="text-xs text-muted-foreground">{a.id} · {a.email}</p>
            <p className="text-xs text-muted-foreground">{a.phone}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-4">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Sales</p>
                <p className="text-sm font-semibold text-primary">{formatCurrency(a.totalSales)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Clients</p>
                <p className="text-sm font-semibold">{a.totalClients}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Commission</p>
                <p className="text-sm font-semibold text-success">{formatCurrency(a.commission)}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
