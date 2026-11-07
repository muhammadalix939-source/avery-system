import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, Database, RefreshCw, Download, FileJson, Check, ExternalLink,
  Pencil, Save, X, Building2, Receipt, Users, BookOpen, UserCheck
} from "lucide-react";
import { db, auth, fetchCollectionFromFirestore, syncDocToFirestore } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CollectionType = "entries" | "suppliers" | "agents" | "bookings" | "clients";

export default function CloudDocumentInspector({ open, onOpenChange }: Props) {
  const [activeCol, setActiveCol] = useState<CollectionType>("entries");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [docsMap, setDocsMap] = useState<Record<CollectionType, Array<Record<string, any>>>>({
    entries: [],
    suppliers: [],
    agents: [],
    bookings: [],
    clients: [],
  });
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<{ id: string; field: string; value: string } | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function loadCollection(colName: CollectionType) {
    if (!auth.currentUser) {
      toast.error("Please connect your Google Account first in Settings to inspect Cloud DB.");
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, colName));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDocsMap((prev) => ({ ...prev, [colName]: items }));
      toast.success(`Loaded ${items.length} records from collection "${colName}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load collection documents");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllCollections() {
    if (!auth.currentUser) {
      toast.error("Please connect your Google Account first in Settings.");
      return;
    }
    setLoading(true);
    try {
      const cols: CollectionType[] = ["entries", "suppliers", "agents", "bookings", "clients"];
      const nextMap = { ...docsMap };
      for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        nextMap[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      setDocsMap(nextMap);
      toast.success("Loaded all Cloud DB collections successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to inspect Firestore");
    } finally {
      setLoading(false);
    }
  }

  async function downloadFullCloudDump() {
    if (!auth.currentUser) {
      toast.error("Please connect your Google Account first.");
      return;
    }
    setDownloadingAll(true);
    try {
      toast.loading("Querying all Firestore documents record by record...", { id: "dump-toast" });
      const cols: CollectionType[] = ["entries", "suppliers", "agents", "bookings", "clients"];
      const dump: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        cloudProject: "xanthic-indexer-c01dl",
        database: "ai-studio-averysystem-5c8ff428-09d9-4efc-b1e2-cdf13d93aca8",
        collections: {},
      };
      for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        dump.collections[col] = snap.docs.map((d) => ({ _documentId: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `firestore-cloud-dump-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Complete Cloud DB JSON backup downloaded to your computer!", { id: "dump-toast" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to dump cloud database", { id: "dump-toast" });
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleSaveQuickEdit() {
    if (!editingDoc) return;
    try {
      await syncDocToFirestore(activeCol, editingDoc.id, { [editingDoc.field]: editingDoc.value });
      setDocsMap((prev) => ({
        ...prev,
        [activeCol]: prev[activeCol].map((doc) =>
          doc.id === editingDoc.id ? { ...doc, [editingDoc.field]: editingDoc.value } : doc
        ),
      }));
      toast.success(`Updated document ${editingDoc.id} in Cloud Firestore!`);
      setEditingDoc(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save update to Cloud DB");
    }
  }

  const currentList = docsMap[activeCol] || [];
  const filteredList = currentList.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const str = JSON.stringify(doc).toLowerCase();
    return str.includes(q);
  });

  const tabIcons: Record<CollectionType, any> = {
    entries: Receipt,
    suppliers: Building2,
    agents: UserCheck,
    bookings: BookOpen,
    clients: Users,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="border-b border-border/50 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  Cloud DB Document Inspector & Record Recovery
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  View and inspect every single record sitting inside Google Cloud Firestore (record-by-record).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://console.firebase.google.com/project/xanthic-indexer-c01dl/firestore/databases/ai-studio-averysystem-5c8ff428-09d9-4efc-b1e2-cdf13d93aca8/data"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition"
              >
                <ExternalLink className="h-3 w-3" />
                Firebase Console
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadFullCloudDump}
                disabled={downloadingAll}
                className="gap-1.5 text-xs h-7.5"
              >
                <Download className={`h-3 w-3 ${downloadingAll ? "animate-spin" : ""}`} />
                Download Raw Cloud JSON
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Collection Selector & Controls */}
        <div className="space-y-3 py-3 border-b border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["entries", "suppliers", "agents", "bookings", "clients"] as CollectionType[]).map((col) => {
                const Icon = tabIcons[col];
                const count = docsMap[col].length;
                return (
                  <button
                    key={col}
                    onClick={() => {
                      setActiveCol(col);
                      if (docsMap[col].length === 0) loadCollection(col);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      activeCol === col
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "bg-accent/20 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="capitalize">{col}</span>
                    <span className={`ml-1 rounded px-1.5 py-0.2 text-[10px] ${activeCol === col ? "bg-black/20 text-primary-foreground" : "bg-accent/40"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => loadCollection(activeCol)}
              disabled={loading}
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh {activeCol}
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${activeCol} (e.g. "Limitless", "Amin Siraj", "Usman", "Jawaid Allahoo", or amount)...`}
              className="pl-9 h-8.5 text-xs bg-accent/20 border-border"
            />
          </div>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {loading && currentList.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p>Fetching records directly from Google Cloud Firestore...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground space-y-3">
              <p>No documents loaded for &ldquo;{activeCol}&rdquo; yet.</p>
              <Button size="sm" onClick={() => loadCollection(activeCol)} className="gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" /> Fetch {activeCol} from Cloud DB
              </Button>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching records found in &ldquo;{activeCol}&rdquo; for &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredList.map((doc) => {
              const docId = String(doc.id || doc._id || "unknown");
              const isExpanded = expandedDocId === docId;
              const title = doc.companyName || doc.name || doc.referenceName || doc.headId || doc.id;
              const subtitle = [
                doc.type,
                doc.amount != null ? formatCurrency(doc.amount) : null,
                doc.date,
                doc.phone,
                doc.serviceType,
                doc.note,
              ].filter(Boolean).join(" · ");

              return (
                <div
                  key={docId}
                  className="rounded-lg border border-border/50 bg-accent/10 p-3 text-xs space-y-2 hover:border-border transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground text-xs">{docId}</span>
                        {title && <span className="font-semibold text-primary truncate">{title}</span>}
                      </div>
                      {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeCol === "suppliers" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const curName = doc.companyName || "";
                            const newName = prompt(`Rename supplier "${curName}" (ID: ${docId}) in Cloud DB:`, curName);
                            if (newName && newName.trim() && newName.trim() !== curName) {
                              setEditingDoc({ id: docId, field: "companyName", value: newName.trim() });
                              // Auto execute rename
                              syncDocToFirestore("suppliers", docId, { companyName: newName.trim() })
                                .then(() => {
                                  setDocsMap((prev) => ({
                                    ...prev,
                                    suppliers: prev.suppliers.map((s) => s.id === docId ? { ...s, companyName: newName.trim() } : s),
                                  }));
                                  toast.success(`Supplier ${docId} renamed to "${newName.trim()}" in Cloud DB!`);
                                })
                                .catch((e) => toast.error(e?.message || "Failed to rename"));
                            }
                          }}
                          className="h-7 text-[10px] gap-1 px-2"
                        >
                          <Pencil className="h-3 w-3" />
                          Rename
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedDocId(isExpanded ? null : docId)}
                        className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <FileJson className="h-3 w-3" />
                        {isExpanded ? "Hide JSON" : "Raw JSON"}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded JSON view */}
                  {isExpanded && (
                    <div className="rounded border border-border/60 bg-black/40 p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-56">
                      <pre>{JSON.stringify(doc, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & close */}
        <div className="border-t border-border/50 pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total: <strong>{currentList.length}</strong> documents in &ldquo;{activeCol}&rdquo;
          </span>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
