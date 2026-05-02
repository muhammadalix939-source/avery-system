import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  onDownload: (range: { fromDate?: string; toDate?: string }) => void;
}

export default function StatementDialog({ open, onOpenChange, title, subtitle, onDownload }: Props) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function handle(allTime = false) {
    onDownload(allTime ? {} : { fromDate: fromDate || undefined, toDate: toDate || undefined });
    onOpenChange(false);
  }

  function preset(months: number) {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">{title}</DialogTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="bg-accent/20 border-border mt-1 h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="bg-accent/20 border-border mt-1 h-9 text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => preset(1)} className="text-xs">Last 30 days</Button>
            <Button variant="outline" size="sm" onClick={() => preset(3)} className="text-xs">Last 3 months</Button>
            <Button variant="outline" size="sm" onClick={() => preset(6)} className="text-xs">Last 6 months</Button>
            <Button variant="outline" size="sm" onClick={() => preset(12)} className="text-xs">Last year</Button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handle(true)} variant="outline" className="flex-1 gap-2">
              <Download className="h-4 w-4" /> All-time
            </Button>
            <Button onClick={() => handle(false)} className="flex-1 gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}