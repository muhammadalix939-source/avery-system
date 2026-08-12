import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Search, Bell, CalendarDays, Users, ClipboardCheck, Archive, RotateCcw, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import ChecklistBadge from "@/components/ChecklistBadge";
import ClientChecklistPanel from "@/components/ClientChecklistPanel";
import { formatCurrency, getClientName, type Client } from "@/lib/data";
import { useStore } from "@/lib/store";
import { computeGroupStats } from "@/lib/groups";
import { computeUrgency, sortByUrgency, urgencyLabel, urgencyTone } from "@/lib/urgency";
import { checklistProgress, getChecklist } from "@/lib/checklist";

export const Route = createFileRoute("/alerts")({
  component: AlertsPage,
  head: () => ({
    meta: [
      { title: "Alerts Hub — Avery International Travel & Tours" },
      { name: "description", content: "Seat-urgency alerts for closing groups and package-completion alerts for every client, in one operational hub." },
      { property: "og:title", content: "Alerts Hub — Avery International Travel & Tours" },
      { property: "og:description", content: "Closing groups, low seats and pending client services — prioritised for daily travel operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Tab = "groups" | "clients";

function AlertsPage() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("groups");
  const [query, setQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [openClient, setOpenClient] = useState<Client | null>(null);

  const groupRows = useMemo(() => {
    const rows = store.groups.map((g) => {
      const stats = computeGroupStats(g, store);
      return { stats, urgency: computeUrgency(stats) };
    });
    return sortByUrgency(rows, (r) => r.urgency);
  }, [store.groups, store.bookings, store.clients, store.entries, store.suppliers]);

  const q = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => groupRows.filter((r) =>
    !q || [r.stats.group.name, r.stats.group.id, r.stats.group.pnr, r.stats.group.category, r.stats.group.date, r.stats.supplier?.companyName]
      .filter(Boolean).join(" ").toLowerCase().includes(q)
  ), [groupRows, q]);

  const clientRows = useMemo(() => {
    const rows = store.clients.map((c) => ({ client: c, progress: checklistProgress(c) }));
    const archived = rows.filter((r) => r.client.checklistArchived || r.progress.isComplete);
    const active = rows.filter((r) => !r.client.checklistArchived && !r.progress.isComplete);
    const pool = showCompleted ? archived : active;
    return pool
      .filter((r) => !q || [getClientName(r.client), r.client.id, r.client.headId, r.client.phone, r.client.packageType,
        ...getChecklist(r.client).map((i) => `${i.label} ${i.status}`)].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.progress.percent - b.progress.percent);
  }, [store.clients, q, showCompleted]);

  const urgentCount = groupRows.filter((r) => r.urgency.level === "critical").length;
  const pendingClients = store.clients.filter((c) => !c.checklistArchived && !checklistProgress(c).isComplete).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts Hub"
        subtitle={`${urgentCount} urgent group${urgentCount === 1 ? "" : "s"} · ${pendingClients} client${pendingClients === 1 ? "" : "s"} with pending services`}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["groups", "clients"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold capitalize transition-all ${tab === t ? "bg-primary text-primary-foreground" : "bg-accent/30 text-muted-foreground hover:bg-accent/50"}`}>
            {t === "groups" ? <CalendarDays className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
            {t}
            <span className="rounded-full bg-background/30 px-1.5 text-[10px]">{t === "groups" ? filteredGroups.length : clientRows.length}</span>
          </button>
        ))}
        <span className="rounded-lg border border-dashed border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Payments · coming soon</span>
      </div>

      <div className="glass-card flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "groups" ? "Search group, PNR, date, supplier..." : "Search client, head ID, service item..."}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>

      {tab === "groups" && (
        <div className="space-y-2">
          {filteredGroups.map(({ stats, urgency }, i) => (
            <motion.div key={stats.group.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className={`glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${urgency.isFull ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${urgencyTone[urgency.level]}`}>{urgencyLabel[urgency.level]}</span>
                <div>
                  <p className="text-sm font-semibold">{stats.group.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[stats.group.id, stats.group.category, stats.group.date || "no date", stats.supplier?.companyName].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5 text-right">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Seats Left</p>
                  <p className={`text-sm font-bold ${urgency.remainingSeats <= 3 ? "text-destructive" : "text-success"}`}>
                    {urgency.capacity > 0 ? `${urgency.remainingSeats} / ${urgency.capacity}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Sales</p>
                  <p className="text-sm font-semibold text-primary">{formatCurrency(stats.revenue)}</p>
                </div>
                <p className="min-w-[120px] text-[10px] text-muted-foreground">{urgency.reason}</p>
              </div>
            </motion.div>
          ))}
          {filteredGroups.length === 0 && <Empty icon={Bell} text="No group alerts match your search." />}
        </div>
      )}

      {tab === "clients" && (
        <>
          <div className="flex gap-2">
            <Button size="sm" variant={showCompleted ? "outline" : "default"} className="h-8 gap-1 text-xs" onClick={() => setShowCompleted(false)}>
              <ClipboardCheck className="h-3.5 w-3.5" /> Active
            </Button>
            <Button size="sm" variant={showCompleted ? "default" : "outline"} className="h-8 gap-1 text-xs" onClick={() => setShowCompleted(true)}>
              <Archive className="h-3.5 w-3.5" /> Completed archive
            </Button>
          </div>

          <div className="space-y-2">
            {clientRows.map(({ client, progress }, i) => (
              <motion.div key={client.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => setOpenClient(client)}
                className="glass-card glass-card-hover flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{getClientName(client)}</p>
                    <p className="text-[10px] text-muted-foreground">{client.id} · {client.headId} · {client.packageType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">
                    {getChecklist(client).filter((it) => it.status !== "Completed").map((it) => it.label).slice(0, 3).join(", ") || "All services arranged"}
                  </span>
                  <ChecklistBadge client={client} />
                  {(client.checklistArchived || progress.isComplete) && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]"
                      onClick={(e) => { e.stopPropagation(); store.setChecklistArchived(client.id, false); }}>
                      <RotateCcw className="h-3 w-3" /> Re-open
                    </Button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
            {clientRows.length === 0 && <Empty icon={ClipboardCheck} text={showCompleted ? "No completed client checklists yet." : "No pending client services. Everything is arranged."} />}
          </div>
        </>
      )}

      <Dialog open={!!openClient} onOpenChange={(o) => !o && setOpenClient(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          {openClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-primary text-sm">{getClientName(openClient)} — Service Checklist</DialogTitle>
                <p className="text-[11px] text-muted-foreground">{openClient.id} · {openClient.headId} · {openClient.packageType}</p>
              </DialogHeader>
              <ClientChecklistPanel client={openClient} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-xl py-14 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
