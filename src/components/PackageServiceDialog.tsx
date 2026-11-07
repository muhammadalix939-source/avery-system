// =========================================================================
//  PackageServiceDialog — full package detail editor for a booking.
//  Package info, inclusion checklist (with custom additions), and every
//  service one-by-one: Hotels (per city), Flights, Transport, Visa,
//  Ziyarah, Other — each with live fulfilment status and urgency.
// =========================================================================
import { useMemo, useState } from "react";
import {
  Hotel, Plane, Car, FileCheck2, Compass, Plus, Trash2, ChevronDown, Check,
  MapPin, CalendarDays, Package, Clock, Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Booking } from "@/lib/data";
import { formatCurrency } from "@/lib/data";
import { useStore } from "@/lib/store";
import {
  DEFAULT_INCLUSIONS, DEFAULT_COMBOS, TRANSPORT_MODES, SAUDI_CITIES,
  MAKKAH_ZIYARAH_SECTORS, MADINAH_ZIYARAH_SECTORS, ROOM_TYPES,
  hotelStatus, flightStatus, transportStatus, visaStatus, ziyarahStatus, otherStatus,
  serviceUrgency, collectBookingServices, serviceSummary, getPackageInfo,
  statusToneService, type ServiceStatus, type InclusionDef,
} from "@/lib/packages";

const cls = (...v: Array<string | false | undefined>) => v.filter(Boolean).join(" ");

function StatusChip({ status }: { status: ServiceStatus }) {
  return (
    <span className={cls("rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide", statusToneService[status])}>
      {status}
    </span>
  );
}

function UrgencyChip({ u }: { u: ReturnType<typeof serviceUrgency> }) {
  if (!u.urgent || u.days === null) return null;
  return (
    <span className={cls("rounded-full border px-2 py-0.5 text-[9px] font-semibold",
      u.overdue ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning")}>
      {u.overdue ? "⚠ " : "⏱ "}{u.label}
    </span>
  );
}

function Section({
  icon, title, count, statuses, children, defaultOpen = false,
}: {
  icon: React.ReactNode; title: string; count: number;
  statuses: ServiceStatus[]; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || count > 0);
  const done = statuses.filter((s) => s === "Completed").length;
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-accent/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="text-primary">{icon}</span>
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-foreground">{title}</span>
        {count > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {done}/{count} ready
          </span>
        )}
        <ChevronDown className={cls("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-border/50 px-3.5 py-3">{children}</div>}
    </div>
  );
}

const inputCls = "mt-0.5 h-8 border-border bg-accent/20 text-xs";
const labelCls = "text-[10px]";

// ---------------------------------------------------------------------------
export default function PackageServiceDialog({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const store = useStore();
  const booking = store.bookings.find((b) => b.id === bookingId);
  const [newInclusion, setNewInclusion] = useState("");
  const [saveInclusion, setSaveInclusion] = useState(true);
  const [newCombo, setNewCombo] = useState("");
  const [saveCombo, setSaveCombo] = useState(true);

  // -------- Add-form state (one per service type) --------
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [hotelForm, setHotelForm] = useState({ city: "Makkah", hotelName: "", roomType: "Quad (4 Sharing)", checkIn: "", checkOut: "", nights: "" });
  const [flightForm, setFlightForm] = useState({ date: "", flightNo: "", from: "", to: "", departure: "", arrival: "" });
  const [transportForm, setTransportForm] = useState({ service: "Airport Transfer", route: "", vehicle: "Private Car", date: "" });
  const [visaForm, setVisaForm] = useState({ visaType: "Umrah", country: "Saudi Arabia", reference: "", issueDate: "" });
  const [ziyarahForm, setZiyarahForm] = useState({ city: "Makkah", sector: "", date: "", vehicle: "Bus (Private)", notes: "" });
  const [otherForm, setOtherForm] = useState({ category: "", description: "", date: "" });

  const rows = useMemo(() => (booking ? collectBookingServices(booking) : []), [booking]);
  const summary = useMemo(() => serviceSummary(rows), [rows]);
  const info = booking ? getPackageInfo(booking) : { inclusions: [] };

  if (!bookingId || !booking) return null;

  const setInfo = (patch: Partial<NonNullable<Booking["packageInfo"]>>) => store.setPackageInfo(booking.id, patch);

  const allInclusions = [
    ...DEFAULT_INCLUSIONS.map((i) => i.label),
    ...store.customInclusions.filter((l) => !DEFAULT_INCLUSIONS.some((d) => d.label === l)),
  ];

  function addInclusion() {
    const l = newInclusion.trim();
    if (!l) return;
    setInfo({ inclusions: info.inclusions.includes(l) ? info.inclusions : [...info.inclusions, l] });
    if (saveInclusion) store.addCustomInclusion(l);
    setNewInclusion("");
  }

  const comboPresets = [
    ...DEFAULT_COMBOS[(info.scope || "International") === "Domestic" ? "domestic" : "international"],
    ...store.customCombos,
  ];

  const saveAdd = () => {
    if (!addOpen) return;
    if (addOpen === "hotel" && hotelForm.hotelName) {
      store.addHotel(booking.id, { city: hotelForm.city, hotelName: hotelForm.hotelName, roomType: hotelForm.roomType, checkIn: hotelForm.checkIn, checkOut: hotelForm.checkOut, nights: Number(hotelForm.nights) || 0 });
      setHotelForm({ city: hotelForm.city, hotelName: "", roomType: hotelForm.roomType, checkIn: "", checkOut: "", nights: "" });
    } else if (addOpen === "flight" && flightForm.flightNo) {
      store.addFlight(booking.id, { ...flightForm });
      setFlightForm({ date: "", flightNo: "", from: "", to: "", departure: "", arrival: "" });
    } else if (addOpen === "transport" && transportForm.route) {
      store.addTransport(booking.id, { ...transportForm });
      setTransportForm({ service: transportForm.service, route: "", vehicle: transportForm.vehicle, date: "" });
    } else if (addOpen === "visa" && visaForm.visaType) {
      store.addVisa(booking.id, { ...visaForm });
      setVisaForm({ visaType: visaForm.visaType, country: visaForm.country, reference: "", issueDate: "" });
    } else if (addOpen === "ziyarah" && ziyarahForm.sector) {
      store.addZiyarah(booking.id, { ...ziyarahForm });
      setZiyarahForm({ city: ziyarahForm.city, sector: "", date: "", vehicle: ziyarahForm.vehicle, notes: "" });
    } else if (addOpen === "other" && otherForm.category) {
      store.addOther(booking.id, { ...otherForm });
      setOtherForm({ category: "", description: "", date: "" });
    } else {
      return;
    }
    setAddOpen(null);
  };

  const addBtn = (key: string, label: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setAddOpen(addOpen === key ? null : key)}
      className="mt-2 w-full gap-1.5 border-dashed border-border/70 text-xs"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </Button>
  );

  const addSaveRow = (
    <div className="mt-2 flex gap-2">
      <Button type="button" size="sm" onClick={saveAdd} className="flex-1 text-xs">Save Service</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAddOpen(null)} className="text-xs">Cancel</Button>
    </div>
  );

  const ziyarahSectors = ziyarahForm.city === "Madinah" ? MADINAH_ZIYARAH_SECTORS : ziyarahForm.city === "Makkah" ? MAKKAH_ZIYARAH_SECTORS : [];

  return (
    <Dialog open={!!bookingId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-2">
            <span className="text-primary">{booking.headId}</span>
            <span className="text-sm font-normal text-muted-foreground">{booking.packageType} · Travel {booking.travelDate}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Fulfilment summary */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-accent/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Package Status</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusChip status={summary.status} />
              <span className="text-xs font-semibold tabular-nums">{summary.percent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${summary.percent}%` }} />
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-accent/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Services Ready</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-success">{summary.completed} / {summary.total}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-accent/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">In Progress</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-warning">{summary.inProgress}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-accent/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Urgent (needs action)</p>
            <p className={cls("mt-1 text-sm font-semibold tabular-nums", summary.urgent > 0 ? "text-destructive" : "text-muted-foreground")}>{summary.urgent}</p>
          </div>
        </div>

        {/* ---------------- Package Details ---------------- */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Package className="h-4 w-4" /> Package Details
            </p>
            <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{booking.packageType}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="col-span-2">
              <Label className={labelCls}>Package Title</Label>
              <Input className={inputCls} value={info.name || ""} onChange={(e) => setInfo({ name: e.target.value })} placeholder={`e.g. 15-Day ${booking.packageType} Executive`} />
            </div>
            <div>
              <Label className={labelCls}>Scope</Label>
              <Select value={info.scope || "International"} onValueChange={(v) => setInfo({ scope: v as "Domestic" | "International" })}>
                <SelectTrigger className={cls("h-8 border-border bg-accent/20 text-xs")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="International">International</SelectItem>
                  <SelectItem value="Domestic">Domestic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelCls}>Country</Label>
              <Input className={inputCls} value={info.destinationCountry || ""} onChange={(e) => setInfo({ destinationCountry: e.target.value })} placeholder="Saudi Arabia" />
            </div>
          </div>

          {/* City combo */}
          <div className="space-y-1.5">
            <Label className={labelCls}>Cities / Route — <MapPin className="inline h-3 w-3" /> Makkah + Madinah style combos</Label>
            <Input
              className={inputCls}
              value={info.destinationCity || ""}
              onChange={(e) => setInfo({ destinationCity: e.target.value })}
              placeholder="e.g. Makkah + Madinah / Jeddah + Makkah + Madinah"
            />
            <div className="flex flex-wrap items-center gap-1">
              {comboPresets.slice(0, 10).map((combo) => (
                <button
                  key={combo} type="button"
                  onClick={() => setInfo({ destinationCity: combo })}
                  className={cls("rounded px-2 py-0.5 text-[10px] transition-colors",
                    info.destinationCity === combo ? "bg-primary text-primary-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/70")}
                >
                  + {combo}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Input
                className="h-7 border-border bg-accent/20 text-xs"
                value={newCombo}
                onChange={(e) => setNewCombo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newCombo.trim()) { store.addCustomCombo(newCombo); setInfo({ destinationCity: newCombo.trim() }); setNewCombo(""); } }}
                placeholder="Add your own route / city combo…"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                <Checkbox checked={saveCombo} onCheckedChange={(v) => setSaveCombo(!!v)} className="h-3.5 w-3.5" /> Save for reuse
              </label>
              <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 text-[10px]"
                onClick={() => { if (newCombo.trim()) { if (saveCombo) store.addCustomCombo(newCombo.trim()); setInfo({ destinationCity: newCombo.trim() }); setNewCombo(""); } }}>
                Add
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><Label className={labelCls}>Duration (Days)</Label><Input type="number" min="1" className={inputCls} value={info.durationDays || ""} onChange={(e) => setInfo({ durationDays: Number(e.target.value) || undefined })} placeholder="15" /></div>
            <div><Label className={labelCls}>Nights</Label><Input type="number" min="0" className={inputCls} value={info.durationNights ?? ""} onChange={(e) => setInfo({ durationNights: Number(e.target.value) || undefined })} placeholder="14" /></div>
            <div><Label className={labelCls}><CalendarDays className="inline h-3 w-3" /> Start Date</Label><Input type="date" className={inputCls} value={info.startDate || ""} onChange={(e) => setInfo({ startDate: e.target.value })} /></div>
            <div><Label className={labelCls}>End Date</Label><Input type="date" className={inputCls} value={info.endDate || ""} onChange={(e) => setInfo({ endDate: e.target.value })} /></div>
          </div>

          {/* Inclusions checklist */}
          <div className="space-y-1.5 border-t border-border/40 pt-2.5">
            <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Package Inclusions — what this package covers
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {allInclusions.map((label) => {
                const on = info.inclusions.includes(label);
                return (
                  <button
                    key={label} type="button"
                    onClick={() => setInfo({ inclusions: on ? info.inclusions.filter((l) => l !== label) : [...info.inclusions, label] })}
                    className={cls("flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors",
                      on ? "border-primary bg-primary/20 font-semibold text-primary" : "border-border/50 bg-accent/10 text-muted-foreground hover:bg-accent/25")}
                  >
                    {label}{on && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Input
                className="h-7 border-border bg-accent/20 text-xs"
                value={newInclusion}
                onChange={(e) => setNewInclusion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addInclusion(); }}
                placeholder="Add any other service to the checklist…"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                <Checkbox checked={saveInclusion} onCheckedChange={(v) => setSaveInclusion(!!v)} className="h-3.5 w-3.5" /> Save for reuse
              </label>
              <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 text-[10px]" onClick={addInclusion}>Add</Button>
            </div>
          </div>
        </div>

        {/* ---------------- Services ---------------- */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Service Details — fill each service completely; status auto-marks Pending → In Progress → Completed
        </p>

        {/* HOTELS */}
        <Section icon={<Hotel className="h-4 w-4" />} title="Hotels" count={(booking.hotels || []).length}
          statuses={(booking.hotels || []).map(hotelStatus)}>
          {(booking.hotels || []).map((h) => {
            const st = hotelStatus(h);
            const u = serviceUrgency("hotel", h.checkIn, booking.travelDate);
            return (
              <div key={h.id} className="mb-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{h.hotelName || "New Hotel"}</span>
                    <StatusChip status={st} /><UrgencyChip u={u} />
                  </div>
                  <button type="button" onClick={() => store.deleteHotel(booking.id, h.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div><Label className={labelCls}>City</Label>
                    <Select value={SAUDI_CITIES.includes(h.city as never) ? h.city : "__custom"} onValueChange={(v) => store.updateHotel(booking.id, h.id, { city: v === "__custom" ? "" : v })}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent>
                        {SAUDI_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="__custom">Other…</SelectItem>
                      </SelectContent>
                    </Select>
                    {!SAUDI_CITIES.includes(h.city as never) && (
                      <Input className={inputCls} value={h.city} onChange={(e) => store.updateHotel(booking.id, h.id, { city: e.target.value })} placeholder="City name" />
                    )}
                  </div>
                  <div><Label className={labelCls}>Hotel Name *</Label><Input className={inputCls} value={h.hotelName} onChange={(e) => store.updateHotel(booking.id, h.id, { hotelName: e.target.value })} placeholder="Noor Al Mashair" /></div>
                  <div><Label className={labelCls}>Room Type</Label>
                    <Select value={h.roomType} onValueChange={(v) => store.updateHotel(booking.id, h.id, { roomType: v })}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select room" /></SelectTrigger>
                      <SelectContent>{ROOM_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className={labelCls}>Check-In *</Label><Input type="date" className={inputCls} value={h.checkIn} onChange={(e) => store.updateHotel(booking.id, h.id, { checkIn: e.target.value })} /></div>
                  <div><Label className={labelCls}>Check-Out *</Label><Input type="date" className={inputCls} value={h.checkOut} onChange={(e) => store.updateHotel(booking.id, h.id, { checkOut: e.target.value })} /></div>
                  <div><Label className={labelCls}>Nights</Label><Input type="number" className={inputCls} value={h.nights || ""} onChange={(e) => store.updateHotel(booking.id, h.id, { nights: Number(e.target.value) || 0 })} /></div>
                </div>
              </div>
            );
          })}
          {addBtn("hotel", "Add Hotel")}
          {addOpen === "hotel" && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div><Label className={labelCls}>City</Label>
                  <Select value={hotelForm.city} onValueChange={(v) => setHotelForm({ ...hotelForm, city: v })}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>{SAUDI_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className={labelCls}>Hotel Name *</Label><Input className={inputCls} value={hotelForm.hotelName} onChange={(e) => setHotelForm({ ...hotelForm, hotelName: e.target.value })} /></div>
                <div><Label className={labelCls}>Room Type</Label>
                  <Select value={hotelForm.roomType} onValueChange={(v) => setHotelForm({ ...hotelForm, roomType: v })}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROOM_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className={labelCls}>Check-In</Label><Input type="date" className={inputCls} value={hotelForm.checkIn} onChange={(e) => setHotelForm({ ...hotelForm, checkIn: e.target.value })} /></div>
                <div><Label className={labelCls}>Check-Out</Label><Input type="date" className={inputCls} value={hotelForm.checkOut} onChange={(e) => setHotelForm({ ...hotelForm, checkOut: e.target.value })} /></div>
                <div><Label className={labelCls}>Nights</Label><Input type="number" className={inputCls} value={hotelForm.nights} onChange={(e) => setHotelForm({ ...hotelForm, nights: e.target.value })} /></div>
              </div>
              {addSaveRow}
            </div>
          )}
        </Section>

        {/* FLIGHTS */}
        <Section icon={<Plane className="h-4 w-4" />} title="Flights" count={(booking.flights || []).length}
          statuses={(booking.flights || []).map(flightStatus)}>
          {(booking.flights || []).map((f) => {
            const st = flightStatus(f);
            const u = serviceUrgency("flight", f.date, booking.travelDate);
            return (
              <div key={f.id} className="mb-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{f.flightNo || "New Flight"}</span>
                    <StatusChip status={st} /><UrgencyChip u={u} />
                  </div>
                  <button type="button" onClick={() => store.deleteFlight(booking.id, f.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div><Label className={labelCls}>Date *</Label><Input type="date" className={inputCls} value={f.date} onChange={(e) => store.updateFlight(booking.id, f.id, { date: e.target.value })} /></div>
                  <div><Label className={labelCls}>Flight No *</Label><Input className={inputCls} value={f.flightNo} onChange={(e) => store.updateFlight(booking.id, f.id, { flightNo: e.target.value })} placeholder="SV-738" /></div>
                  <div><Label className={labelCls}>From *</Label><Input className={inputCls} value={f.from} onChange={(e) => store.updateFlight(booking.id, f.id, { from: e.target.value })} placeholder="Karachi" /></div>
                  <div><Label className={labelCls}>To *</Label><Input className={inputCls} value={f.to} onChange={(e) => store.updateFlight(booking.id, f.id, { to: e.target.value })} placeholder="Jeddah" /></div>
                  <div><Label className={labelCls}>Departure</Label><Input className={inputCls} value={f.departure} onChange={(e) => store.updateFlight(booking.id, f.id, { departure: e.target.value })} placeholder="13:15" /></div>
                  <div><Label className={labelCls}>Arrival</Label><Input className={inputCls} value={f.arrival} onChange={(e) => store.updateFlight(booking.id, f.id, { arrival: e.target.value })} placeholder="16:05" /></div>
                </div>
              </div>
            );
          })}
          {addBtn("flight", "Add Flight")}
          {addOpen === "flight" && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div><Label className={labelCls}>Date</Label><Input type="date" className={inputCls} value={flightForm.date} onChange={(e) => setFlightForm({ ...flightForm, date: e.target.value })} /></div>
                <div><Label className={labelCls}>Flight No *</Label><Input className={inputCls} value={flightForm.flightNo} onChange={(e) => setFlightForm({ ...flightForm, flightNo: e.target.value })} /></div>
                <div><Label className={labelCls}>From</Label><Input className={inputCls} value={flightForm.from} onChange={(e) => setFlightForm({ ...flightForm, from: e.target.value })} /></div>
                <div><Label className={labelCls}>To</Label><Input className={inputCls} value={flightForm.to} onChange={(e) => setFlightForm({ ...flightForm, to: e.target.value })} /></div>
                <div><Label className={labelCls}>Departure</Label><Input className={inputCls} value={flightForm.departure} onChange={(e) => setFlightForm({ ...flightForm, departure: e.target.value })} /></div>
                <div><Label className={labelCls}>Arrival</Label><Input className={inputCls} value={flightForm.arrival} onChange={(e) => setFlightForm({ ...flightForm, arrival: e.target.value })} /></div>
              </div>
              {addSaveRow}
            </div>
          )}
        </Section>

        {/* TRANSPORT */}
        <Section icon={<Car className="h-4 w-4" />} title="Transport" count={(booking.transports || []).length}
          statuses={(booking.transports || []).map(transportStatus)}>
          {(booking.transports || []).map((t) => {
            const st = transportStatus(t);
            const u = serviceUrgency("transport", t.date, booking.travelDate);
            return (
              <div key={t.id} className="mb-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{t.service || t.route || "Transport"}</span>
                    <StatusChip status={st} /><UrgencyChip u={u} />
                  </div>
                  <button type="button" onClick={() => store.deleteTransport(booking.id, t.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div><Label className={labelCls}>Service</Label><Input className={inputCls} value={t.service} onChange={(e) => store.updateTransport(booking.id, t.id, { service: e.target.value })} placeholder="Airport Transfer" /></div>
                  <div className="col-span-2"><Label className={labelCls}>Route / Sector *</Label><Input className={inputCls} value={t.route} onChange={(e) => store.updateTransport(booking.id, t.id, { route: e.target.value })} placeholder="JED Airport → Makkah Hotel → Madinah → JED Airport" /></div>
                  <div><Label className={labelCls}>Mode *</Label>
                    <Select value={t.vehicle} onValueChange={(v) => store.updateTransport(booking.id, t.id, { vehicle: v })}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select mode" /></SelectTrigger>
                      <SelectContent>{TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className={labelCls}>Date *</Label><Input type="date" className={inputCls} value={t.date} onChange={(e) => store.updateTransport(booking.id, t.id, { date: e.target.value })} /></div>
                </div>
              </div>
            );
          })}
          {addBtn("transport", "Add Transport")}
          {addOpen === "transport" && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><Label className={labelCls}>Service</Label><Input className={inputCls} value={transportForm.service} onChange={(e) => setTransportForm({ ...transportForm, service: e.target.value })} /></div>
                <div className="col-span-2"><Label className={labelCls}>Route / Sector *</Label><Input className={inputCls} value={transportForm.route} onChange={(e) => setTransportForm({ ...transportForm, route: e.target.value })} /></div>
                <div><Label className={labelCls}>Mode</Label>
                  <Select value={transportForm.vehicle} onValueChange={(v) => setTransportForm({ ...transportForm, vehicle: v })}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>{TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className={labelCls}>Date</Label><Input type="date" className={inputCls} value={transportForm.date} onChange={(e) => setTransportForm({ ...transportForm, date: e.target.value })} /></div>
              </div>
              {addSaveRow}
            </div>
          )}
        </Section>

        {/* VISA */}
        <Section icon={<FileCheck2 className="h-4 w-4" />} title="Visa" count={(booking.visas || []).length}
          statuses={(booking.visas || []).map(visaStatus)}>
          {(booking.visas || []).map((v) => {
            const st = visaStatus(v);
            const u = serviceUrgency("visa", v.issueDate, booking.travelDate);
            return (
              <div key={v.id} className="mb-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{v.visaType || "Visa"}</span>
                    <StatusChip status={st} /><UrgencyChip u={u} />
                  </div>
                  <button type="button" onClick={() => store.deleteVisa(booking.id, v.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div><Label className={labelCls}>Visa Type *</Label><Input className={inputCls} value={v.visaType} onChange={(e) => store.updateVisa(booking.id, v.id, { visaType: e.target.value })} placeholder="Umrah / Tourist" /></div>
                  <div><Label className={labelCls}>Country *</Label><Input className={inputCls} value={v.country} onChange={(e) => store.updateVisa(booking.id, v.id, { country: e.target.value })} /></div>
                  <div><Label className={labelCls}>Reference / File No *</Label><Input className={inputCls} value={v.reference} onChange={(e) => store.updateVisa(booking.id, v.id, { reference: e.target.value })} placeholder="Application no." /></div>
                  <div><Label className={labelCls}>Issue Date</Label><Input type="date" className={inputCls} value={v.issueDate || ""} onChange={(e) => store.updateVisa(booking.id, v.id, { issueDate: e.target.value })} /></div>
                </div>
              </div>
            );
          })}
          {addBtn("visa", "Add Visa")}
          {addOpen === "visa" && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><Label className={labelCls}>Visa Type</Label><Input className={inputCls} value={visaForm.visaType} onChange={(e) => setVisaForm({ ...visaForm, visaType: e.target.value })} /></div>
                <div><Label className={labelCls}>Country</Label><Input className={inputCls} value={visaForm.country} onChange={(e) => setVisaForm({ ...visaForm, country: e.target.value })} /></div>
                <div><Label className={labelCls}>Reference / File No</Label><Input className={inputCls} value={visaForm.reference} onChange={(e) => setVisaForm({ ...visaForm, reference: e.target.value })} /></div>
                <div><Label className={labelCls}>Issue Date</Label><Input type="date" className={inputCls} value={visaForm.issueDate} onChange={(e) => setVisaForm({ ...visaForm, issueDate: e.target.value })} /></div>
              </div>
              {addSaveRow}
            </div>
          )}
        </Section>

        {/* ZIYARAH */}
        <Section icon={<Compass className="h-4 w-4" />} title="Ziyarah" count={(booking.ziyarahs || []).length}
          statuses={(booking.ziyarahs || []).map(ziyarahStatus)}>
          {(booking.ziyarahs || []).map((z) => {
            const st = ziyarahStatus(z);
            const u = serviceUrgency("ziyarah", z.date, booking.travelDate);
            const sectors = z.city === "Madinah" ? MADINAH_ZIYARAH_SECTORS : z.city === "Makkah" ? MAKKAH_ZIYARAH_SECTORS : [];
            return (
              <div key={z.id} className="mb-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{z.sector || "Ziyarah"}</span>
                    <StatusChip status={st} /><UrgencyChip u={u} />
                  </div>
                  <button type="button" onClick={() => store.deleteZiyarah(booking.id, z.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div><Label className={labelCls}>City</Label>
                    <Select value={z.city} onValueChange={(v) => store.updateZiyarah(booking.id, z.id, { city: v })}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Makkah">Makkah</SelectItem>
                        <SelectItem value="Madinah">Madinah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className={labelCls}>Sector *</Label>
                    {sectors.length > 0 ? (
                      <Select value={z.sector} onValueChange={(v) => store.updateZiyarah(booking.id, z.id, { sector: v })}>
                        <SelectTrigger className={inputCls}><SelectValue placeholder="Select sector" /></SelectTrigger>
                        <SelectContent>{sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input className={inputCls} value={z.sector} onChange={(e) => store.updateZiyarah(booking.id, z.id, { sector: e.target.value })} />
                    )}
                  </div>
                  <div><Label className={labelCls}>Date *</Label><Input type="date" className={inputCls} value={z.date} onChange={(e) => store.updateZiyarah(booking.id, z.id, { date: e.target.value })} /></div>
                  <div><Label className={labelCls}>Vehicle</Label>
                    <Select value={z.vehicle} onValueChange={(v) => store.updateZiyarah(booking.id, z.id, { vehicle: v })}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
          {addBtn("ziyarah", "Add Ziyarah")}
          {addOpen === "ziyarah" && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><Label className={labelCls}>City</Label>
                  <Select value={ziyarahForm.city} onValueChange={(v) => setZiyarahForm({ ...ziyarahForm, city: v, sector: "" })}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Makkah">Makkah</SelectItem><SelectItem value="Madinah">Madinah</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className={labelCls}>Sector *</Label>
                  {ziyarahSectors.length > 0 ? (
                    <Select value={ziyarahForm.sector} onValueChange={(v) => setZiyarahForm({ ...ziyarahForm, sector: v })}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select sector" /></SelectTrigger>
                      <SelectContent>{ziyarahSectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input className={inputCls} value={ziyarahForm.sector} onChange={(e) => setZiyarahForm({ ...ziyarahForm, sector: e.target.value })} />
                  )}
                </div>
                <div><Label className={labelCls}>Date</Label><Input type="date" className={inputCls} value={ziyarahForm.date} onChange={(e) => setZiyarahForm({ ...ziyarahForm, date: e.target.value })} /></div>
                <div><Label className={labelCls}>Vehicle</Label>
                  <Select value={ziyarahForm.vehicle} onValueChange={(v) => setZiyarahForm({ ...ziyarahForm, vehicle: v })}>
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>{TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {addSaveRow}
            </div>
          )}
        </Section>

        {/* OTHER / CUSTOM */}
        <Section icon={<Sparkles className="h-4 w-4" />} title="Other / Custom Services" count={(booking.others || []).length}
          statuses={(booking.others || []).map(otherStatus)}>
          {(booking.others || []).map((o) => (
            <div key={o.id} className="mb-2 rounded-lg border border-border/60 bg-background/60 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{o.category || "Service"}</span>
                  <StatusChip status={otherStatus(o)} />
                </div>
                <button type="button" onClick={() => store.deleteOther(booking.id, o.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><Label className={labelCls}>Category *</Label><Input className={inputCls} value={o.category} onChange={(e) => store.updateOther(booking.id, o.id, { category: e.target.value })} placeholder="Insurance / Lunch / SIM" /></div>
                <div className="col-span-2"><Label className={labelCls}>Description</Label><Input className={inputCls} value={o.description} onChange={(e) => store.updateOther(booking.id, o.id, { description: e.target.value })} /></div>
                <div><Label className={labelCls}>Date</Label><Input type="date" className={inputCls} value={o.date || ""} onChange={(e) => store.updateOther(booking.id, o.id, { date: e.target.value })} /></div>
              </div>
            </div>
          ))}
          {addBtn("other", "Add Custom Service")}
          {addOpen === "other" && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><Label className={labelCls}>Category *</Label><Input className={inputCls} value={otherForm.category} onChange={(e) => setOtherForm({ ...otherForm, category: e.target.value })} /></div>
                <div className="col-span-2"><Label className={labelCls}>Description</Label><Input className={inputCls} value={otherForm.description} onChange={(e) => setOtherForm({ ...otherForm, description: e.target.value })} /></div>
                <div><Label className={labelCls}>Date</Label><Input type="date" className={inputCls} value={otherForm.date} onChange={(e) => setOtherForm({ ...otherForm, date: e.target.value })} /></div>
              </div>
              {addSaveRow}
            </div>
          )}
        </Section>

        <p className="flex items-center gap-1.5 pb-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" /> Visa, flight &amp; hotel turn urgent 3 weeks before travel — transport &amp; ziyarah 2 weeks before. Package value: {formatCurrency(booking.totalAmount)}
        </p>
      </DialogContent>
    </Dialog>
  );
}
