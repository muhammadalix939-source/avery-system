import { useRef, useState } from "react";
import { Download, Upload, DatabaseBackup } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportBackup, importBackup, summarizeBackup, type BackupSummary } from "@/lib/store";
import { toast } from "sonner";

export default function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ text: string; summary: BackupSummary; name: string } | null>(null);

  function download() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `avery-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Backup downloaded");
  }

  async function pick(f?: File) {
    if (!f) return;
    const text = await f.text();
    const summary = summarizeBackup(text);
    if (!summary) { toast.error("This file has no CRM data in it."); return; }
    setPending({ text, summary, name: f.name });
  }

  function restore(mode: "replace" | "merge") {
    if (!pending) return;
    try {
      const s = importBackup(pending.text, mode);
      toast.success(`Restored: ${s.clients} clients, ${s.bookings} bookings, ${s.entries} entries`);
      setPending(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  const s = pending?.summary;
  const partial = s && s.clients === 0 && s.bookings === 0 && s.entries === 0;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <DatabaseBackup className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Backup & Restore</h2>
          <p className="text-xs text-muted-foreground">Download all your data as a file, or bring it back from a saved file.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={download}><Download className="mr-2 h-4 w-4" />Download Backup</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Restore from File</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {s && (
        <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
          <p className="font-medium">{pending!.name} contains:</p>
          <p className="text-muted-foreground">
            {s.clients} clients · {s.bookings} bookings · {s.entries} entries · {s.agents} agents · {s.suppliers} suppliers · {s.groups} groups · {s.accounts} accounts
          </p>
          {partial && (
            <p className="text-warning">This file has only accounts — no clients, bookings or entries. Use "Add to current data" so nothing is lost.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => restore("merge")}>Add to current data</Button>
            <Button size="sm" variant="destructive" disabled={!!partial} onClick={() => restore("replace")}>Replace all data with this file</Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
