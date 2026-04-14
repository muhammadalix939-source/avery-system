import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { mockBookings, mockClients, mockAgents, mockSuppliers, formatCurrency } from "@/lib/data";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search — AV Travel CRM" }] }),
});

type ResultType = "booking" | "client" | "agent" | "supplier";

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  status: string;
  extra?: string;
}

function searchAll(query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  mockBookings.forEach((b) => {
    if (b.headId.toLowerCase().includes(q) || b.agentId.toLowerCase().includes(q) || b.supplierId.toLowerCase().includes(q)) {
      results.push({ type: "booking", id: b.headId, title: b.headId, subtitle: `${b.packageType} · ${b.clientIds.length} clients`, status: b.status, extra: formatCurrency(b.totalAmount) });
    }
  });

  mockClients.forEach((c) => {
    if (c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.passport.toLowerCase().includes(q)) {
      results.push({ type: "client", id: c.id, title: c.name, subtitle: `${c.id} · ${c.headId}`, status: c.paymentStatus, extra: formatCurrency(c.amountPaid) });
    }
  });

  mockAgents.forEach((a) => {
    if (a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.phone.includes(q)) {
      results.push({ type: "agent", id: a.id, title: a.name, subtitle: `${a.id} · ${a.totalClients} clients`, status: a.status, extra: formatCurrency(a.totalSales) });
    }
  });

  mockSuppliers.forEach((s) => {
    if (s.id.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q) || s.phone.includes(q)) {
      const remaining = s.totalPayable - s.totalPaid;
      results.push({ type: "supplier", id: s.id, title: s.companyName, subtitle: `${s.id} · ${s.serviceType}`, status: remaining === 0 ? "Paid" : "Partial", extra: formatCurrency(remaining) });
    }
  });

  return results;
}

const typeColors: Record<ResultType, string> = {
  booking: "bg-primary/10 text-primary",
  client: "bg-success/10 text-success",
  agent: "bg-warning/10 text-warning",
  supplier: "bg-chart-3/10 text-chart-3",
};

function SearchPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResultType | "all">("all");

  const results = searchAll(query);
  const filtered = typeFilter === "all" ? results : results.filter((r) => r.type === typeFilter);

  return (
    <div className="space-y-6">
      <PageHeader title="Search" subtitle="Find any record instantly" />

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by Head ID, Client ID, Name, Phone, Agent, Supplier..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 bg-accent/20 pl-12 text-base border-border"
        />
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "booking", "client", "agent", "supplier"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-lg px-4 py-2 text-xs font-medium capitalize transition-all ${
              typeFilter === t ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {t === "all" ? "All" : `${t}s`}
          </button>
        ))}
      </div>

      {/* Results */}
      {query && (
        <p className="text-xs text-muted-foreground">{filtered.length} results found</p>
      )}

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <motion.div
            key={`${r.type}-${r.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass-card glass-card-hover flex items-center justify-between rounded-xl px-5 py-4 transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase ${typeColors[r.type]}`}>
                {r.type}
              </span>
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {r.extra && <span className="text-sm font-medium text-primary">{r.extra}</span>}
              <StatusBadge status={r.status} />
            </div>
          </motion.div>
        ))}
      </div>

      {query && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <SearchIcon className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
