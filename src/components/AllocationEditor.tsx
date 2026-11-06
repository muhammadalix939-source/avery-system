import { useState, useEffect } from "react";
import { Plus, Trash2, Lock, Unlock, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/SearchableSelect";
import { formatCurrency } from "@/lib/data";
import {
  splitEqual,
  rebalanceEqual,
  autoBalanceLast,
} from "@/lib/allocations";
import type { CostAllocation, PaymentAllocation, AllocationTarget } from "@/lib/store";

export interface AllocationEditorProps {
  total: number;
  value: CostAllocation[] | PaymentAllocation[];
  onChange: (val: any) => void;
  mode: "purchase" | "payment";
  heads: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
  groups?: Array<{ id: string; name: string; pnr?: string; category?: string }>;
  clients?: Array<{ id: string; headId: string; name: string }>;
  allocationMode?: "equal" | "manual";
  onAllocationModeChange?: (m: "equal" | "manual") => void;
}

export default function AllocationEditor({
  total,
  value,
  onChange,
  mode,
  heads,
  agents,
  groups = [],
  clients = [],
  allocationMode: controlledMode,
  onAllocationModeChange,
}: AllocationEditorProps) {
  const [localMode, setLocalMode] = useState<"equal" | "manual">("equal");
  const allocMode = controlledMode ?? localMode;

  const setAllocMode = (m: "equal" | "manual") => {
    setLocalMode(m);
    onAllocationModeChange?.(m);
    if (m === "equal" && mode === "purchase") {
      const rebalanced = rebalanceEqual(value as CostAllocation[], total);
      onChange(rebalanced);
    }
  };

  // Keep Equal mode balanced when total changes
  useEffect(() => {
    if (allocMode === "equal" && mode === "purchase" && value.length > 0) {
      const currentSum = value.reduce((s, l) => s + (l.amount || 0), 0);
      if (currentSum !== total) {
        const rebalanced = rebalanceEqual(value as CostAllocation[], total);
        onChange(rebalanced);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, allocMode, mode]);

  const allocatedSum = value.reduce((s, l) => s + (l.amount || 0), 0);
  const remaining = total - allocatedSum;
  const isBalanced = remaining === 0;

  // Add a line for purchase
  const addPurchaseLine = (target: AllocationTarget) => {
    const lines = [...(value as CostAllocation[])];
    const newId = `A${lines.length + 1}`;
    let newLine: CostAllocation;

    if (target === "head") {
      const defaultHead = heads[0]?.id || "";
      newLine = { id: newId, target: "head", headId: defaultHead, amount: 0 };
    } else if (target === "agent") {
      const defaultAgent = agents[0]?.id || "";
      newLine = { id: newId, target: "agent", agentId: defaultAgent, amount: 0, saleAmount: 0 };
    } else {
      newLine = { id: newId, target: "office", amount: 0 };
    }

    const next = [...lines, newLine];
    if (allocMode === "equal") {
      onChange(rebalanceEqual(next, total));
    } else {
      onChange(autoBalanceLast(next, total));
    }
  };

  // Add a line for payment
  const addPaymentLine = (target: "head" | "group" | "agent" | "unallocated") => {
    const lines = [...(value as PaymentAllocation[])];
    const newId = `P${lines.length + 1}`;
    let newLine: PaymentAllocation;

    if (target === "head") {
      newLine = { id: newId, target: "head", headId: heads[0]?.id || "", amount: 0 };
    } else if (target === "group") {
      newLine = { id: newId, target: "group", groupId: groups[0]?.id || "", amount: 0 };
    } else if (target === "agent") {
      newLine = { id: newId, target: "agent", agentId: agents[0]?.id || "", amount: 0 };
    } else {
      newLine = { id: newId, target: "unallocated", amount: 0 };
    }

    const next = [...lines, newLine];
    if (allocMode === "equal") {
      const splits = splitEqual(total, next.length);
      onChange(next.map((l, i) => ({ ...l, amount: splits[i] })));
    } else {
      const otherSum = lines.reduce((s, l) => s + (l.amount || 0), 0);
      newLine.amount = Math.max(0, total - otherSum);
      onChange([...lines, newLine]);
    }
  };

  // Remove a line
  const removeLine = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    if (allocMode === "equal" && mode === "purchase") {
      onChange(rebalanceEqual(next as CostAllocation[], total));
    } else {
      onChange(next);
    }
  };

  // Update a line
  const updateLine = (index: number, patch: Partial<CostAllocation | PaymentAllocation>) => {
    const next = value.map((l, i) => (i === index ? { ...l, ...patch } : l));
    onChange(next);
  };

  // Auto-balance last line in manual mode
  const handleAutoBalance = () => {
    if (mode === "purchase") {
      onChange(autoBalanceLast(value as CostAllocation[], total));
    } else {
      if (value.length === 0) return;
      const otherSum = value.slice(0, -1).reduce((s, l) => s + (l.amount || 0), 0);
      const remainder = Math.max(0, total - otherSum);
      const next = value.map((l, i) => (i === value.length - 1 ? { ...l, amount: remainder } : l));
      onChange(next);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:p-4 text-xs">
      {/* Header controls & live chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2.5">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-accent/20 p-1">
          <button
            type="button"
            onClick={() => setAllocMode("equal")}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              allocMode === "equal" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Equal (Auto)
          </button>
          <button
            type="button"
            onClick={() => setAllocMode("manual")}
            className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
              allocMode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Manual Shares
          </button>
        </div>

        {/* Live balance chips */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]" aria-live="polite">
          <span className="rounded bg-accent/40 px-2 py-0.5 text-foreground">
            Total: <b>{formatCurrency(total)}</b>
          </span>
          <span className="rounded bg-accent/40 px-2 py-0.5 text-foreground">
            Allocated: <b>{formatCurrency(allocatedSum)}</b>
          </span>
          <span
            className={`flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
              isBalanced ? "bg-success/20 text-success border border-success/30" : "bg-destructive/20 text-destructive border border-destructive/30"
            }`}
          >
            {isBalanced ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            Remaining: {remaining > 0 ? `+${formatCurrency(remaining)}` : formatCurrency(remaining)}
          </span>
        </div>
      </div>

      {/* Allocation Rows */}
      <div className="space-y-2.5">
        {value.length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            No allocation lines yet. Add targets below to split this {mode === "purchase" ? "purchase" : "payment"}.
          </p>
        )}

        {value.map((line, idx) => {
          const costLine = line as CostAllocation;
          const isAgent = line.target === "agent";
          const isHead = line.target === "head";
          const isGroup = line.target === "group";
          const isOffice = line.target === "office" || line.target === "unallocated";

          const headMembers = isHead && costLine.headId ? clients.filter((c) => c.headId === costLine.headId) : [];

          return (
            <div
              key={line.id || idx}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/70 p-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-2"
            >
              {/* Target Type Badge */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isHead
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : isAgent
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : isGroup
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {line.target === "head" ? "Client Head" : line.target === "agent" ? "Agent" : line.target === "group" ? "Group / PNR" : "Office"}
                </span>

                <div className="flex items-center gap-1 sm:hidden">
                  {mode === "purchase" && (
                    <button
                      type="button"
                      aria-label="Toggle lock"
                      onClick={() => updateLine(idx, { locked: !costLine.locked })}
                      className={`p-1.5 rounded active-press ${costLine.locked ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {costLine.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Remove line"
                    onClick={() => removeLine(idx)}
                    className="p-1.5 rounded text-destructive hover:bg-destructive/15 active-press"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Target Selectors */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                {isHead && (
                  <>
                    <SearchableSelect
                      value={costLine.headId || ""}
                      onChange={(v) => updateLine(idx, { headId: v, clientId: undefined })}
                      placeholder="Select client head..."
                      options={heads.map((h) => ({ value: h.id, label: `${h.id} — ${h.name}` }))}
                      className="h-8 text-xs"
                    />
                    {headMembers.length > 0 && (
                      <SearchableSelect
                        value={costLine.clientId || ""}
                        onChange={(v) => updateLine(idx, { clientId: v || undefined })}
                        placeholder="Whole Head (All)"
                        options={[
                          { value: "", label: "Whole Head (Shared)" },
                          ...headMembers.map((m) => ({ value: m.id, label: `${m.id} — ${m.name}` })),
                        ]}
                        className="h-8 text-xs"
                      />
                    )}
                  </>
                )}

                {isAgent && (
                  <>
                    <SearchableSelect
                      value={line.agentId || ""}
                      onChange={(v) => updateLine(idx, { agentId: v })}
                      placeholder="Select agent..."
                      options={agents.map((a) => ({ value: a.id, label: `${a.id} — ${a.name}` }))}
                      className="h-8 text-xs"
                    />
                    {mode === "purchase" && (
                      <Input
                        value={costLine.forClientName || ""}
                        onChange={(e) => updateLine(idx, { forClientName: e.target.value })}
                        placeholder="Passenger name"
                        className="h-8 text-xs bg-accent/20 border-border"
                      />
                    )}
                  </>
                )}

                {isGroup && (
                  <SearchableSelect
                    value={(line as PaymentAllocation).groupId || ""}
                    onChange={(v) => updateLine(idx, { groupId: v })}
                    placeholder="Select group..."
                    options={groups.map((g) => ({
                      value: g.id,
                      label: `${g.id} — ${g.name}`,
                      hint: [g.category, g.pnr && `PNR ${g.pnr}`].filter(Boolean).join(" · "),
                    }))}
                    className="h-8 text-xs"
                  />
                )}

                {isOffice && (
                  <div className="flex items-center text-xs text-muted-foreground px-2 py-1 italic">
                    {mode === "purchase" ? "Office / Stock inventory" : "Unallocated supplier payment"}
                  </div>
                )}
              </div>

              {/* Share & Sale Amount inputs */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="w-28">
                  <Label className="text-[9px] text-muted-foreground">Share PKR</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    readOnly={allocMode === "equal"}
                    value={line.amount !== undefined ? line.amount : ""}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value) || 0);
                      const patch: Partial<CostAllocation> = { amount: v };
                      if (isAgent && costLine.saleAmount === costLine.amount) {
                        patch.saleAmount = v;
                      }
                      updateLine(idx, patch);
                    }}
                    className={`h-8 text-xs text-right font-mono ${
                      allocMode === "equal" ? "bg-accent/40 font-semibold cursor-not-allowed" : "bg-accent/20 border-border"
                    }`}
                  />
                </div>

                {mode === "purchase" && isAgent && (
                  <div className="w-28">
                    <Label className="text-[9px] text-muted-foreground">Sale to Agent</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={costLine.saleAmount !== undefined ? costLine.saleAmount : costLine.amount}
                      onChange={(e) => updateLine(idx, { saleAmount: Math.round(Number(e.target.value) || 0) })}
                      className="h-8 text-xs text-right font-mono bg-accent/20 border-border"
                    />
                  </div>
                )}

                {/* Desktop lock & remove buttons */}
                <div className="hidden sm:flex items-center gap-1 pt-3.5">
                  {mode === "purchase" && (
                    <button
                      type="button"
                      aria-label="Toggle lock"
                      onClick={() => updateLine(idx, { locked: !costLine.locked })}
                      className={`p-1.5 rounded transition ${costLine.locked ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {costLine.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Remove line"
                    onClick={() => removeLine(idx)}
                    className="p-1.5 rounded text-destructive hover:bg-destructive/15 transition active-press"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Extra line options (Profit read-out for Agent, "Also bill client" for Head) */}
              {mode === "purchase" && isAgent && (
                <div className="w-full sm:w-auto sm:ml-auto flex items-center justify-between sm:justify-end gap-2 text-[10px] text-muted-foreground border-t sm:border-t-0 border-border/40 pt-1.5 sm:pt-0">
                  {(() => {
                    const c = costLine.amount || 0;
                    const s = costLine.saleAmount !== undefined ? costLine.saleAmount : c;
                    const p = s - c;
                    return (
                      <span className="font-mono">
                        Profit: <b className={p >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(p)}</b>
                      </span>
                    );
                  })()}
                </div>
              )}

              {mode === "purchase" && isHead && (
                <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground border-t sm:border-t-0 border-border/40 pt-1.5 sm:pt-0">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!costLine.billClient}
                      onChange={(e) => updateLine(idx, { billClient: e.target.checked })}
                      className="rounded border-border text-primary"
                    />
                    <span>Also bill client</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons under rows */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-primary/20">
        <div className="flex flex-wrap items-center gap-1.5">
          {mode === "purchase" ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => addPurchaseLine("head")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Head
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addPurchaseLine("agent")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Agent
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addPurchaseLine("office")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Office / Stock
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => addPaymentLine("head")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Head
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addPaymentLine("group")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Group
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addPaymentLine("agent")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Agent
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addPaymentLine("unallocated")} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Unallocated
              </Button>
            </>
          )}
        </div>

        {allocMode === "manual" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleAutoBalance}
            className="h-7 text-[11px] gap-1 text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" /> Auto-balance last
          </Button>
        )}
      </div>

      {/* Explanatory notes matching existing style */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {mode === "purchase"
          ? "Head shares post directly as cost to that Head's Business View. Agent shares post as Other Sale in the agent's ledger with disclosed profit."
          : "Head lines credit that Head's supplier payments. Group lines are prorated among the group's heads by their purchase cost share."}
      </p>
    </div>
  );
}
