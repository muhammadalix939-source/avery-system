// =========================================================================
//  Package & Services engine — the single source of truth for package
//  inclusions, city/route combos, transport modes, ziyarah sectors,
//  per-service fulfilment status and time-based urgency.
//  Used by: Purchase entry package builder, Booking package details,
//  Booking view, Agent / Supplier service breakdowns, Invoice PDF.
// =========================================================================
import type {
  Booking, HotelService, FlightService, TransportService, VisaService,
  OtherService, ZiyarahService, PackageInfo,
} from "./data";
import { daysUntil } from "./urgency";

// ---------- Catalogs ----------
export const TRANSPORT_MODES = [
  "Bus (Sharing)", "Bus (Private)", "Private Car", "Private Van (Hiace / GMC)",
  "One-Way Private", "Return Private", "Luxury Coach", "SUV / Land Cruiser",
  "Train (Mashair)", "Airport Transfer",
] as const;

export const VEHICLE_TYPES = TRANSPORT_MODES;

export const SAUDI_CITIES = ["Makkah", "Madinah", "Jeddah", "Taif", "Riyadh", "Dammam"] as const;

export const MAKKAH_ZIYARAH_SECTORS = [
  "Mina", "Arafat", "Muzdalifah", "Jabal Al Noor (Hira Cave)", "Jabal Thawr",
  "Masjid Ayesha (Taneem)", "Masjid Al Jinn", "Jabal Rahmah", "Mazmallah Market",
] as const;

export const MADINAH_ZIYARAH_SECTORS = [
  "Masjid Quba", "Masjid Qiblatain", "Mount Uhud", "Masjid Al Qiblatayn (Seven Mosques)",
  "Masjid Al Ghamama", "Dates Market (Madinah)", "Saqifah Bani Sa'idah", "Wadi E Jinn (Al-Juhfa)",
] as const;

export const ROOM_TYPES = [
  "Quad (4 Sharing)", "Triple (3 Sharing)", "Double (2 Sharing)", "Single", "Quint (5 Sharing)", "Suite",
] as const;

export interface InclusionDef {
  label: string;
  kind: "flight" | "hotel" | "visa" | "transport" | "ziyarah" | "meal" | "insurance" | "guide" | "processing" | "custom";
}

/** Preset inclusions — extendable by the user from the package builder (saved in the store). */
export const DEFAULT_INCLUSIONS: InclusionDef[] = [
  { label: "Flight Tickets", kind: "flight" },
  { label: "Hotel Accommodation", kind: "hotel" },
  { label: "Visa Processing", kind: "visa" },
  { label: "Private Transport", kind: "transport" },
  { label: "Guided Ziyarah", kind: "ziyarah" },
  { label: "Ziyarah Makkah", kind: "ziyarah" },
  { label: "Ziyarah Madinah", kind: "ziyarah" },
  { label: "Daily Breakfast", kind: "meal" },
  { label: "Travel Insurance", kind: "insurance" },
  { label: "Meet & Greet at Airport", kind: "guide" },
  { label: "Nusuk / Mukim Permit", kind: "processing" },
  { label: "Zam Zam Water (5L)", kind: "custom" },
  { label: "Tour Guide", kind: "guide" },
  { label: "Laundry Service", kind: "custom" },
  { label: "Wheelchair Assistance", kind: "custom" },
];

export const DEFAULT_COMBOS: Record<"international" | "domestic", string[]> = {
  international: [
    "Makkah + Madinah", "Dubai + Abu Dhabi", "Istanbul + Antalya", "Baku + Gabala",
    "Kuala Lumpur + Langkawi", "Bangkok + Phuket", "Jeddah + Makkah + Madinah", "Makkah + Madinah + Taif",
  ],
  domestic: [
    "Hunza + Skardu", "Naran + Kagan + Swat", "Murree + Bhurban", "Gwadar Beach",
    "Skardu + Deosai", "Swat + Kalam + Malam Jabba",
  ],
};

export const INCLUSION_KIND_ICON: Record<InclusionDef["kind"], string> = {
  flight: "✈", hotel: "🏨", visa: "🛂", transport: "🚌", ziyarah: "🕌",
  meal: "🍽", insurance: "🛡", guide: "🧭", processing: "📋", custom: "✦",
};

// ---------- Fulfilment status ----------
export type ServiceStatus = "Completed" | "In Progress" | "Pending";

export const statusToneService: Record<ServiceStatus, string> = {
  Pending: "text-muted-foreground border-border bg-muted/40",
  "In Progress": "text-warning border-warning/30 bg-warning/10",
  Completed: "text-success border-success/30 bg-success/10",
};

const filled = (...vals: Array<string | number | undefined | null>) =>
  vals.some((v) => v !== undefined && v !== null && String(v).trim() !== "");
const complete = (...vals: Array<string | number | undefined | null>) =>
  vals.every((v) => v !== undefined && v !== null && String(v).trim() !== "");

export function hotelStatus(h: Partial<HotelService>): ServiceStatus {
  if (complete(h.hotelName, h.city, h.checkIn, h.checkOut)) return "Completed";
  return filled(h.hotelName, h.city, h.roomType, h.checkIn, h.checkOut, h.nights) ? "In Progress" : "Pending";
}
export function flightStatus(f: Partial<FlightService>): ServiceStatus {
  if (complete(f.flightNo, f.date, f.from, f.to)) return "Completed";
  return filled(f.flightNo, f.date, f.from, f.to, f.departure, f.arrival) ? "In Progress" : "Pending";
}
export function transportStatus(t: Partial<TransportService>): ServiceStatus {
  if (complete(t.route, t.date, t.vehicle)) return "Completed";
  return filled(t.route, t.date, t.vehicle, t.service) ? "In Progress" : "Pending";
}
export function visaStatus(v: Partial<VisaService>): ServiceStatus {
  if (complete(v.visaType, v.country, v.reference)) return "Completed";
  return filled(v.visaType, v.country, v.reference, v.issueDate) ? "In Progress" : "Pending";
}
export function ziyarahStatus(z: Partial<ZiyarahService>): ServiceStatus {
  if (complete(z.sector, z.city, z.date)) return "Completed";
  return filled(z.sector, z.city, z.date, z.vehicle) ? "In Progress" : "Pending";
}
export function otherStatus(o: Partial<OtherService>): ServiceStatus {
  return filled(o.description, o.category) ? "Completed" : "Pending";
}

// ---------- Time-based urgency ----------
// Visa / flight / hotel must be locked 3 weeks before travel; transport & ziyarah 2 weeks.
export const URGENCY_DAYS: Record<InclusionDef["kind"], number> = {
  visa: 21, flight: 21, hotel: 21, transport: 14, ziyarah: 14,
  meal: 14, insurance: 21, guide: 14, processing: 21, custom: 14,
};

export interface ServiceUrgency {
  urgent: boolean;
  days: number | null;   // days until the service date (travel date fallback)
  overdue: boolean;
  label: string;
}

export function serviceUrgency(
  kind: InclusionDef["kind"],
  date?: string,
  fallbackDate?: string,
): ServiceUrgency {
  const d = daysUntil(date || fallbackDate);
  if (d === null) return { urgent: false, days: null, overdue: false, label: "" };
  const window = URGENCY_DAYS[kind];
  const overdue = d < 0;
  const urgent = overdue || d <= window;
  const label = overdue ? `Overdue ${Math.abs(d)}d` : d === 0 ? "Today" : `In ${d}d`;
  return { urgent, days: d, overdue, label };
}

// ---------- Whole-booking service map ----------
export interface ServiceRow {
  key: string;
  group: "Hotel" | "Flight" | "Visa" | "Transport" | "Ziyarah" | "Other";
  title: string;
  sub: string;
  status: ServiceStatus;
  date?: string;
  urgency: ServiceUrgency;
}

function row(
  key: string, group: ServiceRow["group"], title: string, sub: string,
  status: ServiceStatus, kind: InclusionDef["kind"], date?: string, fallback?: string,
): ServiceRow {
  return { key, group, title, sub, status, date, urgency: serviceUrgency(kind, date, fallback) };
}

export function collectBookingServices(b: Booking): ServiceRow[] {
  const rows: ServiceRow[] = [];
  (b.hotels || []).forEach((h, i) => rows.push(row(
    `h${h.id || i}`, "Hotel",
    [h.hotelName || "Unnamed Hotel", h.city && `(${h.city})`].filter(Boolean).join(" "),
    [h.roomType && `${h.roomType}`, h.checkIn && `In ${h.checkIn}`, h.checkOut && `Out ${h.checkOut}`, h.nights && `${h.nights} night(s)`].filter(Boolean).join(" · "),
    hotelStatus(h), "hotel", h.checkIn, b.travelDate,
  )));
  (b.flights || []).forEach((f, i) => rows.push(row(
    `f${f.id || i}`, "Flight",
    f.flightNo || "Flight",
    [f.from && `${f.from} → ${f.to || "?"}`, f.date, f.departure && `Dep ${f.departure}`, f.arrival && `Arr ${f.arrival}`].filter(Boolean).join(" · "),
    flightStatus(f), "flight", f.date, b.travelDate,
  )));
  (b.transports || []).forEach((t, i) => rows.push(row(
    `t${t.id || i}`, "Transport",
    t.service || t.route || "Transport",
    [t.route, t.vehicle, t.date].filter(Boolean).join(" · "),
    transportStatus(t), "transport", t.date, b.travelDate,
  )));
  (b.visas || []).forEach((v, i) => rows.push(row(
    `v${v.id || i}`, "Visa",
    v.visaType || "Visa",
    [v.country, v.reference && `Ref ${v.reference}`, v.issueDate && `Issued ${v.issueDate}`].filter(Boolean).join(" · "),
    visaStatus(v), "visa", v.issueDate, b.travelDate,
  )));
  (b.ziyarahs || []).forEach((z, i) => rows.push(row(
    `z${z.id || i}`, "Ziyarah",
    z.sector || "Ziyarah",
    [z.city, z.date, z.vehicle].filter(Boolean).join(" · "),
    ziyarahStatus(z), "ziyarah", z.date, b.travelDate,
  )));
  (b.others || []).forEach((o, i) => rows.push(row(
    `o${o.id || i}`, "Other",
    o.category || "Service",
    o.description || "",
    otherStatus(o), "custom", o.date, b.travelDate,
  )));
  return rows;
}

export const SERVICE_GROUP_ICONS: Record<ServiceRow["group"], string> = {
  Hotel: "🏨", Flight: "✈", Visa: "🛂", Transport: "🚌", Ziyarah: "🕌", Other: "✦",
};

export interface ServiceSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  urgent: number;
  percent: number;
  isComplete: boolean;
  status: ServiceStatus;
}

export function serviceSummary(rows: ServiceRow[]): ServiceSummary {
  const completed = rows.filter((r) => r.status === "Completed").length;
  const inProgress = rows.filter((r) => r.status === "In Progress").length;
  const pending = rows.filter((r) => r.status === "Pending").length;
  const urgent = rows.filter((r) => r.urgency.urgent && r.status !== "Completed").length;
  return {
    total: rows.length, completed, inProgress, pending, urgent,
    percent: rows.length ? Math.round((completed / rows.length) * 100) : 0,
    isComplete: rows.length > 0 && completed === rows.length,
    status: rows.length === 0 ? "Pending" : completed === rows.length ? "Completed" : inProgress > 0 ? "In Progress" : "Pending",
  };
}

// ---------- Package info ----------
export function getPackageInfo(b: Booking): PackageInfo {
  return b.packageInfo && Array.isArray(b.packageInfo.inclusions)
    ? b.packageInfo
    : { inclusions: [] };
}

export function setInclusionInList(list: string[], label: string, on: boolean): string[] {
  return on ? (list.includes(label) ? list : [...list, label]) : list.filter((l) => l !== label);
}

/** Bookings whose package type is a full package (not a single service). */
export function isPackageBooking(b: Booking): boolean {
  return /umrah|hajj|tour|package|custom|honeymoon|family|ziyar/i.test(b.packageType || "");
}

export function durationNights(info: Partial<PackageInfo>): number {
  if (info.durationNights && info.durationNights > 0) return info.durationNights;
  if (info.durationDays && info.durationDays > 0) return Math.max(0, info.durationDays - 1);
  return 0;
}
