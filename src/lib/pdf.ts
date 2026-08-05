import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, getClientName } from "./data";
import type {
  Client, Agent, Supplier, Booking,
  HotelService, FlightService, TransportService, VisaService, OtherService,
} from "./data";
import type { LedgerEntry } from "./store";
import { AVERY_LOGO_PNG } from "@/assets/avery-logo";

// =========================================================================
//  AVERY GROUP OF TRAVEL — High-End Luxury PDF Template
//  Ivory parchment + Navy + Antique Gold. Serif headings. Logo top-left.
// =========================================================================

const COMPANY = "AVERY GROUP OF TRAVEL";
const SLOGAN = "Umrah · Hajj · Ziyarah · International & Domestic Tours · Visas · Transport";
const TAGLINE = "Curated journeys. Trusted service. Worldwide reach.";
const COMPANY_ADDR = "IBM Center, Paper Market, Office 204, Karachi, Pakistan";
const COMPANY_PHONE = "0330-2793701  ·  0310-2326386  ·  0322-3241659";
const COMPANY_EMAIL = "averyinternationaltraveltours@gmail.com";

// Premium palette
const NAVY: [number, number, number]   = [11, 24, 56];
const GOLD: [number, number, number]   = [176, 137, 52];   // antique gold
const GOLD_LT: [number, number, number]= [212, 178, 102];
const IVORY: [number, number, number]  = [252, 249, 241];  // parchment
const ROW_ALT: [number, number, number]= [247, 243, 232];
const INK: [number, number, number]    = [22, 28, 44];
const MUTED: [number, number, number]  = [110, 110, 120];
const WHITE: [number, number, number]  = [255, 255, 255];
const SUCCESS: [number, number, number]= [22, 110, 60];
const DANGER: [number, number, number] = [170, 35, 35];

// ---------- Page chrome ----------
function header(doc: jsPDF, title: string) {
  // Ivory page background
  doc.setFillColor(...IVORY);
  doc.rect(0, 0, 210, 297, "F");

  // Outer luxury double border
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, 194, 281);
  doc.setLineWidth(0.2);
  doc.rect(10, 10, 190, 277);

  // Navy header band
  doc.setFillColor(...NAVY);
  doc.rect(10, 10, 190, 26, "F");
  // Gold pinstripe under header
  doc.setFillColor(...GOLD);
  doc.rect(10, 36, 190, 0.8, "F");

  // Logo (top-left, inside the navy band)
  try {
    doc.addImage(AVERY_LOGO_PNG, "PNG", 14, 13, 20, 20, undefined, "FAST");
  } catch {
    // fall-through: no logo
  }

  // Wordmark
  doc.setTextColor(...GOLD_LT);
  doc.setFont("times", "bold");
  doc.setFontSize(17);
  doc.text(COMPANY, 38, 22);

  doc.setFont("times", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text(SLOGAN, 38, 28);
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  doc.text(TAGLINE, 38, 32.5);

  // Document title (right)
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), 196, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Issued: ${now}`, 196, 28, { align: "right" });

  doc.setTextColor(...INK);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Gold pinstripe above footer
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(14, 273, 196, 273);
    doc.setLineWidth(0.15);
    doc.line(14, 274.4, 196, 274.4);

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(COMPANY, 14, 279);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(COMPANY_ADDR, 14, 283);
    doc.text(`${COMPANY_PHONE}   ·   ${COMPANY_EMAIL}`, 14, 287);

    doc.setFont("times", "italic");
    doc.setTextColor(...GOLD);
    doc.setFontSize(7.5);
    doc.text("Your journey begins with trust.", 196, 283, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`Page ${i} of ${pages}`, 196, 287, { align: "right" });
  }
}

// ---------- Section helpers ----------
function sectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(text.toUpperCase(), 14, y);

  // Gold rule under heading
  const w = doc.getTextWidth(text.toUpperCase());
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(14, y + 1.5, 14 + Math.max(w, 30), y + 1.5);
  doc.setLineWidth(0.15);
  doc.line(14, y + 2.4, 196, y + 2.4);

  doc.setTextColor(...INK);
}

function brandTable(doc: jsPDF, opts: Parameters<typeof autoTable>[1]) {
  autoTable(doc, {
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8.5, fontStyle: "bold", halign: "left", cellPadding: 2.5, overflow: "linebreak", valign: "middle" },
    bodyStyles: { fontSize: 8.5, textColor: INK, cellPadding: 2.5, font: "helvetica", overflow: "linebreak", valign: "top" },
    alternateRowStyles: { fillColor: ROW_ALT },
    styles: { lineColor: GOLD_LT, lineWidth: 0.15, overflow: "linebreak", cellWidth: "wrap" },
    margin: { left: 14, right: 14 },
    tableWidth: "auto",
    ...opts,
  });
}

function partyBlock(doc: jsPDF, x: number, y: number, w: number, label: string, lines: Array<[string, string]>) {
  // Box with gold left bar + ivory fill
  doc.setFillColor(...IVORY);
  doc.rect(x, y, w, 6 + lines.length * 5 + 4, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, 6 + lines.length * 5 + 4);
  doc.setFillColor(...GOLD);
  doc.rect(x, y, 1.2, 6 + lines.length * 5 + 4, "F");

  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(label.toUpperCase(), x + 4, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  lines.forEach(([k, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, x + 4, y + 10 + i * 5);
    doc.setFont("helvetica", "normal");
    doc.text(String(v || "—"), x + 28, y + 10 + i * 5);
  });
  return y + 6 + lines.length * 5 + 6;
}

function fromAndTo(doc: jsPDF, y: number, recipientLabel: string, recipientLines: Array<[string, string]>) {
  const fromLines: Array<[string, string]> = [
    ["Company", "Avery Group of Travel"],
    ["Address", "IBM Center, Office 204, Karachi"],
    ["Phone", "0330-2793701, 0310-2326386"],
    ["Email", "averyinternationaltraveltours@gmail.com"],
  ];
  const yA = partyBlock(doc, 14, y, 88, "From", fromLines);
  const yB = partyBlock(doc, 108, y, 88, recipientLabel, recipientLines);
  return Math.max(yA, yB);
}

function totalsBand(doc: jsPDF, y: number, label: string, value: string, tone: "gold" | "navy" = "gold") {
  if (tone === "gold") doc.setFillColor(...GOLD);
  else doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 11, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(label.toUpperCase(), 18, y + 7.4);
  doc.text(value, 192, y + 7.4, { align: "right" });
  doc.setTextColor(...INK);
  return y + 14;
}

function summaryCards(doc: jsPDF, y: number, cards: Array<[string, string, "ink" | "success" | "danger" | "gold"]>) {
  const n = cards.length;
  const totalW = 182;
  const gap = 2;
  const cardW = (totalW - gap * (n - 1)) / n;
  cards.forEach(([label, value, tone], i) => {
    const x = 14 + i * (cardW + gap);
    // navy header
    doc.setFillColor(...NAVY);
    doc.rect(x, y, cardW, 5, "F");
    // ivory body
    doc.setFillColor(...WHITE);
    doc.rect(x, y + 5, cardW, 14, "F");
    doc.setDrawColor(...GOLD_LT);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cardW, 19);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(label.toUpperCase(), x + 3, y + 3.5);

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    if (tone === "success") doc.setTextColor(...SUCCESS);
    else if (tone === "danger") doc.setTextColor(...DANGER);
    else if (tone === "gold") doc.setTextColor(...GOLD);
    else doc.setTextColor(...NAVY);
    doc.text(value, x + 3, y + 13.5);
  });
  doc.setTextColor(...INK);
  return y + 23;
}

function save(doc: jsPDF, name: string) {
  doc.save(name.replace(/\s+/g, "_"));
}

function fmtDate(s?: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function labelType(t: LedgerEntry["type"]): string {
  switch (t) {
    case "client_receive": return "Receive";
    case "supplier_payment": return "Supplier Pmt";
    case "agent_commission": return "Commission";
    case "expense": return "Expense";
    case "purchase": return "Purchase";
    case "client_charge": return "Extra Charge";
    case "client_refund": return "Client Refund";
    case "supplier_refund": return "Supplier Refund";
    default: return t;
  }
}

// =========================================================================
//  STATEMENT — Supplier / Agent (with optional date filter & service sections)
// =========================================================================

export interface StatementOptions {
  /** Filter entries by date range (inclusive). YYYY-MM-DD */
  fromDate?: string;
  toDate?: string;
  /** Bookings used to render Hotel/Flight/Visa/Transport/Other sections. */
  bookings?: Booking[];
  /** Include opening balance (brought-forward) in totals & opening row. Default true. */
  includeOpening?: boolean;
  /** Optional purchase-group filter (only entries with matching groupId are included). */
  groupId?: string;
  /** Human-readable group label for the header banner when groupId is set. */
  groupLabel?: string;
}

function inRange(date: string, from?: string, to?: string) {
  if (!from && !to) return true;
  const d = new Date(date).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to + "T23:59:59").getTime()) return false;
  return true;
}

function renderServiceSections(doc: jsPDF, y: number, bookings: Booking[]): number {
  const allHotels: Array<HotelService & { headId: string }> = [];
  const allFlights: Array<FlightService & { headId: string }> = [];
  const allTransports: Array<TransportService & { headId: string }> = [];
  const allVisas: Array<VisaService & { headId: string }> = [];
  const allOthers: Array<OtherService & { headId: string }> = [];
  bookings.forEach((b) => {
    (b.hotels || []).forEach((h) => allHotels.push({ ...h, headId: b.headId }));
    (b.flights || []).forEach((f) => allFlights.push({ ...f, headId: b.headId }));
    (b.transports || []).forEach((t) => allTransports.push({ ...t, headId: b.headId }));
    (b.visas || []).forEach((v) => allVisas.push({ ...v, headId: b.headId }));
    (b.others || []).forEach((o) => allOthers.push({ ...o, headId: b.headId }));
  });

  if (allHotels.length) {
    sectionTitle(doc, `Hotels (${allHotels.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "City", "Hotel", "Room", "Check-In", "Check-Out", "Nights"]],
      body: allHotels.map((h) => [h.headId, h.city, h.hotelName, h.roomType, fmtDate(h.checkIn), fmtDate(h.checkOut), String(h.nights)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allFlights.length) {
    sectionTitle(doc, `Flights (${allFlights.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Date", "Flight", "From", "To", "Dep", "Arr"]],
      body: allFlights.map((f) => [f.headId, fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allVisas.length) {
    const total = allVisas.reduce((s, v) => s + (v.amount || 0), 0);
    sectionTitle(doc, `Visas (${allVisas.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Type", "Country", "Reference", "Issue Date", "Amount"]],
      body: allVisas.map((v) => [v.headId, v.visaType, v.country, v.reference, fmtDate(v.issueDate), { content: formatCurrency(v.amount || 0), styles: { halign: "right" as const } }]),
      foot: [[{ content: "Total Visa Amount", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }, { content: formatCurrency(total), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }]],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allTransports.length) {
    const total = allTransports.reduce((s, t) => s + (t.amount || 0), 0);
    sectionTitle(doc, `Transport (${allTransports.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Service", "Route", "Vehicle", "Date", "Amount"]],
      body: allTransports.map((t) => [t.headId, t.service, t.route, t.vehicle, fmtDate(t.date), { content: formatCurrency(t.amount || 0), styles: { halign: "right" as const } }]),
      foot: total ? [[{ content: "Total Transport", colSpan: 5, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }, { content: formatCurrency(total), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }]] : undefined,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (allOthers.length) {
    const total = allOthers.reduce((s, o) => s + (o.amount || 0), 0);
    sectionTitle(doc, `Other Services (${allOthers.length})`, y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Booking", "Category", "Description", "Date", "Amount"]],
      body: allOthers.map((o) => [o.headId, o.category, o.description, fmtDate(o.date), { content: formatCurrency(o.amount || 0), styles: { halign: "right" as const } }]),
      foot: total ? [[{ content: "Total Other", colSpan: 4, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }, { content: formatCurrency(total), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } }]] : undefined,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  return y;
}

// =========================================================================
//  SUPPLIER LEDGER / STATEMENT
// =========================================================================
export function generateSupplierLedger(supplier: Supplier, entries: LedgerEntry[], opts: StatementOptions = {}) {
  const doc = new jsPDF();
  supplierHeader(doc);

  const filtered = entries
    .filter((e) => inRange(e.date, opts.fromDate, opts.toDate))
    .filter((e) => !opts.groupId || e.groupId === opts.groupId);
  const periodLabel = opts.fromDate || opts.toDate
    ? `${fmtDate(opts.fromDate)} — ${fmtDate(opts.toDate)}`
    : "All-time";

  const includeOpening = opts.includeOpening !== false && !opts.groupId;
  const openingPayable = includeOpening ? (supplier.openingPayable || 0) : 0;
  const openingPaid = includeOpening ? (supplier.openingPaid || 0) : 0;
  const openingBF = openingPayable - openingPaid;

  const purchases = filtered.filter((e) => e.type === "purchase");
  const payments = filtered.filter((e) => e.type === "supplier_payment");

  const totalPurchases = purchases.reduce((s, e) => s + e.amount, 0);
  const totalPaid = payments.reduce((s, e) => s + e.amount, 0);
  const grandPayable = openingPayable + totalPurchases;
  const grandPaid = openingPaid + totalPaid;
  const remaining = grandPayable - grandPaid;

  let y = 66;
  y = supplierMetaBar(doc, y, {
    stmtNo: `AV-SS-${supplier.id.replace(/[^0-9A-Z]/gi, "")}-${new Date().getFullYear()}`,
    period: periodLabel,
    groupLabel: opts.groupId ? (opts.groupLabel || opts.groupId) : undefined,
  });
  y = supplierIdentityCard(doc, y, supplier);
  const pctPaid = grandPayable > 0 ? Math.max(0, Math.min(100, (grandPaid / grandPayable) * 100)) : 0;
  y = executiveSnapshot(doc, y, {
    payable: grandPayable, paid: grandPaid, remaining,
    bf: includeOpening ? openingBF : undefined,
    purchases: purchases.length, payments: payments.length,
    pctPaid,
  });

  // Group purchases by serviceCategory
  const groups = new Map<string, LedgerEntry[]>();
  for (const p of purchases) {
    const key = p.serviceCategory || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const order = ["Flight", "Hotel", "Visa", "Transport", "Ziyarah", "Insurance", "Other"];
  const sortedKeys = [
    ...order.filter((k) => groups.has(k)),
    ...Array.from(groups.keys()).filter((k) => !order.includes(k)),
  ];

  for (const key of sortedKeys) {
    const rows = groups.get(key)!;
    const catTotal = rows.reduce((s, e) => s + e.amount, 0);
    y = categoryHeading(doc, y, key, rows.length, catTotal, "navy");

    const { head, body } = buildPurchaseTable(key, rows);
    const colSpanForTotal = head[0].length - 1;
    brandTable(doc, {
      startY: y + 1,
      head,
      body,
      foot: [[
        { content: `Total ${key}`, colSpan: colSpanForTotal, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
        { content: formatCurrency(catTotal), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  if (payments.length || (includeOpening && openingPaid > 0)) {
    y = categoryHeading(doc, y, "Payments Received", payments.length, grandPaid, "success");
    const body: any[] = [];
    if (includeOpening && openingPaid > 0) {
      body.push([
        { content: "Opening Paid (B/F)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: ROW_ALT } },
        { content: formatCurrency(openingPaid), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
      ]);
    }
    for (const p of payments) {
      body.push([
        fmtDate(p.date), p.id, p.note || "—",
        { content: formatCurrency(p.amount), styles: { halign: "right" as const, textColor: SUCCESS } },
      ]);
    }
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Receipt", "Note", "Amount"]],
      body,
      foot: [[
        { content: "Total Paid", colSpan: 3, styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: NAVY } },
        { content: formatCurrency(grandPaid), styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: ROW_ALT, textColor: SUCCESS } },
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  y = reconciliationBlock(doc, y, {
    openingPayable: includeOpening ? openingPayable : undefined,
    openingPaid: includeOpening ? openingPaid : undefined,
    totalPurchases, totalPaid, grandPayable, grandPaid,
  });

  closingHero(doc, y, remaining);

  footer(doc);
  save(doc, `Avery_Supplier_Statement_${supplier.id}.pdf`);
}

// ---- Supplier statement — premium helpers ----
function supplierHeader(doc: jsPDF) {
  // Ivory base
  doc.setFillColor(...IVORY);
  doc.rect(0, 0, 210, 297, "F");

  // Full-bleed navy cover band (taller, editorial)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 54, "F");

  // Subtle gold hairlines top & bottom of cover
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(0, 3, 210, 3);
  doc.setLineWidth(0.25);
  doc.line(0, 51, 210, 51);
  doc.setLineWidth(0.6);
  doc.line(0, 53, 210, 53);

  // Logo circle (gold ring)
  try {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.circle(24, 27, 13);
    doc.addImage(AVERY_LOGO_PNG, "PNG", 13, 16, 22, 22, undefined, "FAST");
  } catch {}

  // Wordmark
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...GOLD_LT);
  doc.text("AVERY", 42, 24);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("GROUP OF TRAVEL", 42, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  doc.text("Umrah · Hajj · Ziyarah · International & Domestic Tours · Visas · Transport", 42, 36);
  doc.setFont("times", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text("Curated journeys. Trusted service. Worldwide reach.", 42, 41.5);

  // Right side: document title, big serif
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text("SUPPLIER", 196, 24, { align: "right" });
  doc.setTextColor(...GOLD_LT);
  doc.text("STATEMENT", 196, 33, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Issued ${now}`, 196, 40, { align: "right" });

  doc.setTextColor(...INK);
}

function supplierMetaBar(doc: jsPDF, y: number, meta: { stmtNo: string; period: string; groupLabel?: string }): number {
  const h = meta.groupLabel ? 13 : 9;
  doc.setFillColor(...IVORY);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.25);
  doc.rect(14, y, 182, h, "FD");
  // Left gold bar
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.4, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("STATEMENT NO.", 19, y + 4);
  doc.text("PERIOD", 92, y + 4);
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(meta.stmtNo, 19, y + 8);
  doc.text(meta.period, 92, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("CURRENCY", 168, y + 4);
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("PKR", 168, y + 8);

  if (meta.groupLabel) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text(`Filtered by Group  ·  ${meta.groupLabel}`, 19, y + 11.5);
  }
  doc.setTextColor(...INK);
  return y + h + 3;
}

function supplierIdentityCard(doc: jsPDF, y: number, s: Supplier): number {
  const h = 26;
  // Card
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.2);
  doc.rect(14, y, 182, h, "FD");

  // Left navy plate
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 62, h, "F");
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.2, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...GOLD_LT);
  doc.text("STATEMENT ISSUED TO", 20, y + 5.5);

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(s.companyName || "—", 20, y + 12.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  doc.text(s.id, 20, y + 17.5);
  doc.setTextColor(...WHITE);
  doc.text(s.serviceType || "—", 20, y + 22);

  // Right details grid
  const col1 = 82;
  const col2 = 140;
  const labelStyle = () => { doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(...GOLD); };
  const valStyle = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK); };

  labelStyle(); doc.text("CONTACT PERSON", col1, y + 5.5);
  valStyle(); doc.text(s.contactPerson || "—", col1, y + 10);

  labelStyle(); doc.text("PHONE", col1, y + 15);
  valStyle(); doc.text(s.phone || "—", col1, y + 19.5);

  labelStyle(); doc.text("EMAIL", col2, y + 5.5);
  valStyle(); doc.text(s.email || "—", col2, y + 10);

  labelStyle(); doc.text("ACCOUNT STATUS", col2, y + 15);
  valStyle();
  const status = "Active";
  doc.text(status, col2, y + 19.5);

  doc.setTextColor(...INK);
  return y + h + 5;
}

function executiveSnapshot(
  doc: jsPDF, y: number,
  data: { payable: number; paid: number; remaining: number; bf?: number; purchases: number; payments: number; pctPaid: number }
): number {
  // Section title
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("Executive Snapshot", 14, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, 60, y + 1.5);
  doc.setLineWidth(0.1);
  doc.setDrawColor(...GOLD_LT);
  doc.line(60, y + 1.5, 196, y + 1.5);

  y += 5;

  // 4 KPI tiles
  const tiles: Array<{ label: string; value: string; tone: "navy" | "gold" | "success" | "danger" }> = [
    { label: "Total Payable", value: formatCurrency(data.payable), tone: "navy" },
    { label: "Total Paid", value: formatCurrency(data.paid), tone: "success" },
    { label: "Outstanding", value: formatCurrency(data.remaining), tone: data.remaining > 0 ? "danger" : "success" },
    { label: data.bf !== undefined ? "Brought Forward" : "Transactions", value: data.bf !== undefined ? formatCurrency(data.bf) : `${data.purchases} PUR · ${data.payments} PMT`, tone: "gold" },
  ];
  const totalW = 182;
  const gap = 3;
  const w = (totalW - gap * 3) / 4;
  const h = 22;
  tiles.forEach((t, i) => {
    const x = 14 + i * (w + gap);
    // ivory card
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...GOLD_LT);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, "FD");
    // top gold hairline
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(x, y, x + w, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(t.label.toUpperCase(), x + 3.5, y + 5.5);

    doc.setFont("times", "bold");
    doc.setFontSize(t.value.length > 14 ? 10 : 12);
    if (t.tone === "navy") doc.setTextColor(...NAVY);
    else if (t.tone === "success") doc.setTextColor(...SUCCESS);
    else if (t.tone === "danger") doc.setTextColor(...DANGER);
    else doc.setTextColor(...GOLD);
    doc.text(t.value, x + 3.5, y + 15);
  });
  y += h + 4;

  // Settlement progress bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("SETTLEMENT PROGRESS", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`${data.pctPaid.toFixed(1)}% of payable settled`, 196, y, { align: "right" });

  const barY = y + 2;
  const barW = 182;
  // track
  doc.setFillColor(230, 224, 208);
  doc.rect(14, barY, barW, 4, "F");
  // fill
  const fillW = Math.max(0.6, (data.pctPaid / 100) * barW);
  doc.setFillColor(...GOLD);
  doc.rect(14, barY, fillW, 4, "F");
  // end tick
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(14 + fillW, barY - 0.6, 14 + fillW, barY + 4.6);

  return y + 10;
}

function categoryHeading(doc: jsPDF, y: number, label: string, count: number, total: number, tone: "navy" | "success" = "navy"): number {
  // Elegant heading strip: gold vertical bar + serif category + count pill + right-aligned total
  const h = 8.5;
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 1.6, h, "F");
  doc.setFillColor(...IVORY);
  doc.rect(15.6, y, 180.4, h, "F");
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.15);
  doc.line(14, y + h, 196, y + h);

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(label, 19, y + 6);
  // measure label in its own font BEFORE switching
  const labelW = doc.getTextWidth(label);

  // count pill (in pill font)
  const pillTxt = `${count} ${count === 1 ? "item" : "items"}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const pillW = doc.getTextWidth(pillTxt) + 5;
  const pillX = 19 + labelW + 4;
  doc.setFillColor(...NAVY);
  doc.roundedRect(pillX, y + 2.2, pillW, 4.4, 1.2, 1.2, "F");
  doc.setTextColor(...GOLD_LT);
  doc.text(pillTxt, pillX + pillW / 2, y + 5.3, { align: "center" });

  // right total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("SECTION TOTAL", 165, y + 3.6, { align: "right" });
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  if (tone === "success") doc.setTextColor(...SUCCESS);
  else doc.setTextColor(...NAVY);
  doc.text(formatCurrency(total), 194, y + 6.2, { align: "right" });

  doc.setTextColor(...INK);
  return y + h + 2;
}

function reconciliationBlock(
  doc: jsPDF, y: number,
  d: { openingPayable?: number; openingPaid?: number; totalPurchases: number; totalPaid: number; grandPayable: number; grandPaid: number }
): number {
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("Ledger Reconciliation", 14, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, 60, y + 1.5);
  doc.setLineWidth(0.1);
  doc.setDrawColor(...GOLD_LT);
  doc.line(60, y + 1.5, 196, y + 1.5);
  y += 5;

  const colW = 89;
  const gap = 4;
  const leftRows: Array<[string, number, boolean?]> = [];
  if (d.openingPayable !== undefined) leftRows.push(["Opening Payable (B/F)", d.openingPayable]);
  leftRows.push(["New Purchases (Period)", d.totalPurchases]);
  leftRows.push(["Grand Total Payable", d.grandPayable, true]);

  const rightRows: Array<[string, number, boolean?]> = [];
  if (d.openingPaid !== undefined) rightRows.push(["Opening Paid (B/F)", d.openingPaid]);
  rightRows.push(["Payments (Period)", d.totalPaid]);
  rightRows.push(["Grand Total Paid", d.grandPaid, true]);

  const rows = Math.max(leftRows.length, rightRows.length);
  const rowH = 6.5;
  const h = 6 + rows * rowH + 3;

  // Left card (payable)
  drawReconCard(doc, 14, y, colW, h, "Payable Side", NAVY, leftRows);
  // Right card (paid)
  drawReconCard(doc, 14 + colW + gap, y, colW, h, "Settlement Side", SUCCESS, rightRows);

  return y + h + 6;
}

function drawReconCard(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  title: string, accent: [number, number, number], rows: Array<[string, number, boolean?]>
) {
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GOLD_LT);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "FD");
  // header strip
  doc.setFillColor(...accent);
  doc.rect(x, y, w, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), x + 3, y + 4.2);

  doc.setTextColor(...INK);
  rows.forEach(([label, val, bold], i) => {
    const ry = y + 6 + 5 + i * 6.5;
    if (bold) {
      doc.setFillColor(...IVORY);
      doc.rect(x + 0.4, ry - 4, w - 0.8, 6, "F");
    }
    doc.setFont(bold ? "times" : "helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.setTextColor(...(bold ? NAVY : INK));
    doc.text(label, x + 3, ry);
    doc.setFont("times", "bold");
    doc.setFontSize(bold ? 9.5 : 8.5);
    doc.setTextColor(...(bold ? accent : INK));
    doc.text(formatCurrency(val), x + w - 3, ry, { align: "right" });
  });
  doc.setTextColor(...INK);
}

function closingHero(doc: jsPDF, y: number, remaining: number) {
  // If not enough room, add a page
  if (y > 240) { doc.addPage(); y = 30; }
  const h = 30;
  // Navy panel
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, h, "F");
  // Gold double frame
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.rect(14, y, 182, h);
  doc.setLineWidth(0.15);
  doc.rect(16, y + 2, 178, h - 4);
  // Left gold plate
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 2, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_LT);
  doc.text("CLOSING BALANCE", 22, y + 9);
  doc.setFont("times", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text("Net amount payable to supplier as of statement date.", 22, y + 15);

  doc.setFont("times", "bold");
  doc.setFontSize(20);
  const tone: [number, number, number] = remaining > 0 ? GOLD_LT : [180, 220, 190];
  doc.setTextColor(...tone);
  doc.text(formatCurrency(remaining), 192, y + 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  doc.text(remaining > 0 ? "Outstanding — Payment Due" : remaining < 0 ? "Overpayment / Advance" : "Fully Settled", 192, y + 22, { align: "right" });

  // Auth line
  doc.setFont("times", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LT);
  doc.text("Computer-generated statement · Avery Group of Travel · This document does not require a signature.", 105, y + 27, { align: "center" });
  doc.setTextColor(...INK);
}

// Build category-specific purchase table
function buildPurchaseTable(category: string, rows: LedgerEntry[]): { head: any[][]; body: any[][] } {
  const cur = (n?: number) => formatCurrency(n || 0);
  if (category === "Hotel") {
    return {
      head: [["Date", "Receipt", "Hotel", "City", "Rooms", "Nights", "Per Night", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        return [
          fmtDate(e.date), e.id, d.hotelName || e.note || "—", d.city || "—",
          String(d.rooms || "—"), String(d.nights || "—"),
          { content: d.perNight ? cur(d.perNight) : "—", styles: { halign: "right" as const } },
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }
  if (category === "Flight") {
    return {
      head: [["Date", "Receipt", "Description", "Adults", "Children", "Infants", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        return [
          fmtDate(e.date), e.id, d.description || e.note || "—",
          `${d.adults || 0} × ${cur(d.adultPrice)}`,
          `${d.children || 0} × ${cur(d.childPrice)}`,
          `${d.infants || 0} × ${cur(d.infantPrice)}`,
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }
  if (category === "Visa") {
    return {
      head: [["Date", "Receipt", "Type", "Country", "Reference", "Pax", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
        return [
          fmtDate(e.date), e.id, d.visaType || "—", d.country || "—",
          d.reference || e.note || "—", String(pax || "—"),
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }
  if (category === "Transport") {
    return {
      head: [["Date", "Receipt", "Route", "Vehicle", "Pax", "Amount"]],
      body: rows.map((e) => {
        const d = e.purchaseDetails || {};
        const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
        return [
          fmtDate(e.date), e.id, d.route || e.note || "—", d.vehicle || "—",
          String(pax || "—"),
          { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
        ];
      }),
    };
  }
  // Ziyarah, Insurance, Other, and any custom category
  return {
    head: [["Date", "Receipt", "Description", "Pax", "Amount"]],
    body: rows.map((e) => {
      const d = e.purchaseDetails || {};
      const pax = (d.adults || 0) + (d.children || 0) + (d.infants || 0);
      return [
        fmtDate(e.date), e.id, d.description || e.note || "—",
        String(pax || "—"),
        { content: cur(e.amount), styles: { halign: "right" as const, textColor: NAVY } },
      ];
    }),
  };
}

// =========================================================================
//  AGENT REPORT / STATEMENT
// =========================================================================
export function generateAgentReport(agent: Agent, entries: LedgerEntry[], opts: StatementOptions = {}) {
  const doc = new jsPDF();
  header(doc, "Agent Statement");

  const filtered = entries.filter((e) => inRange(e.date, opts.fromDate, opts.toDate));
  const periodLabel = opts.fromDate || opts.toDate
    ? `${fmtDate(opts.fromDate)} — ${fmtDate(opts.toDate)}`
    : "All-time";

  let y = 44;
  y = fromAndTo(doc, y, "Agent", [
    ["ID", agent.id],
    ["Name", agent.name],
    ["Phone", agent.phone],
    ["Status", agent.status],
  ]);

  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 7, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Statement Period: ${periodLabel}`, 18, y + 5);
  doc.text(`Email: ${agent.email}`, 192, y + 5, { align: "right" });
  doc.setTextColor(...INK);
  y += 11;

  const openingComm = agent.openingCommission || 0;
  const openingPaid = agent.openingPaidCommission || 0;
  const totalSales = (agent.totalSales || 0) + (agent.openingSales || 0);
  const totalClients = (agent.totalClients || 0) + (agent.openingClients || 0);
  const totalCommission = (agent.commission || 0) + openingComm;
  const totalPaidCommission = (agent.paidCommission || 0) + openingPaid;
  const payable = totalCommission - totalPaidCommission;

  y = summaryCards(doc, y, [
    ["Total Sales", formatCurrency(totalSales), "navy" as any],
    ["Total Clients", String(totalClients), "ink"],
    ["Commission", formatCurrency(totalCommission), "gold"],
    ["Paid", formatCurrency(totalPaidCommission), "success"],
  ]);
  y += 2;

  if (opts.bookings && opts.bookings.length) {
    y = renderServiceSections(doc, y, opts.bookings);
  }

  if (filtered.length) {
    sectionTitle(doc, "Commission History", y); y += 4;
    let running = openingComm - openingPaid;
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Receipt", "Note", "Amount", "Balance"]],
      body: [
        [{ content: "Brought Forward (B/F)", colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: ROW_ALT } }, { content: formatCurrency(openingComm - openingPaid), styles: { halign: "right" as const, fillColor: ROW_ALT } }, { content: formatCurrency(running), styles: { halign: "right" as const, fillColor: ROW_ALT, textColor: NAVY } }],
        ...filtered.map((e) => {
          running -= e.amount;
          return [
            fmtDate(e.date), e.id, e.note,
            { content: `- ${formatCurrency(e.amount)}`, styles: { halign: "right" as const, textColor: SUCCESS } },
            { content: formatCurrency(running), styles: { halign: "right" as const, textColor: NAVY } },
          ];
        }),
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  totalsBand(doc, y, "Payable to Agent", formatCurrency(payable));

  footer(doc);
  save(doc, `Avery_Agent_Statement_${agent.id}.pdf`);
}

// =========================================================================
//  CLIENT STATEMENT
// =========================================================================
export function generateClientStatement(client: Client, entries: LedgerEntry[], opts: StatementOptions = {}) {
  const doc = new jsPDF();
  header(doc, "Client Statement");

  const filtered = entries.filter((e) => inRange(e.date, opts.fromDate, opts.toDate));
  const periodLabel = opts.fromDate || opts.toDate
    ? `${fmtDate(opts.fromDate)} — ${fmtDate(opts.toDate)}`
    : "All-time";

  let y = 44;
  y = fromAndTo(doc, y, "Client", [
    ["ID", client.id],
    ["Name", getClientName(client)],
    ["Head ID", client.headId],
    ["Passport", client.passport || "—"],
  ]);

  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 7, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Statement Period: ${periodLabel}`, 18, y + 5);
  doc.text(`Package: ${client.packageType}   ·   Phone: ${client.phone}`, 192, y + 5, { align: "right" });
  doc.setTextColor(...INK);
  y += 11;

  const openingPaid = client.openingPaid || 0;
  const totalDue = client.amountDue;
  const totalPaid = client.amountPaid + openingPaid;
  const remaining = totalDue - totalPaid;

  y = summaryCards(doc, y, [
    ["Opening Paid", formatCurrency(openingPaid), "ink"],
    ["Total Due", formatCurrency(totalDue), "navy" as any],
    ["Total Paid", formatCurrency(totalPaid), "success"],
    ["Remaining", formatCurrency(remaining), "danger"],
  ]);
  y += 2;

  if (opts.bookings && opts.bookings.length) {
    y = renderServiceSections(doc, y, opts.bookings);
  }

  if (filtered.length) {
    sectionTitle(doc, "Payment History", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Receipt", "Description", "Amount"]],
      body: filtered.map((e) => [fmtDate(e.date), e.id, e.note || e.referenceName, { content: formatCurrency(e.amount), styles: { halign: "right" as const, textColor: SUCCESS } }]),
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  totalsBand(doc, y, "Balance Due", formatCurrency(remaining));

  footer(doc);
  save(doc, `Avery_Client_Statement_${client.id}.pdf`);
}

// =========================================================================
//  PAYMENT HISTORY (generic, used by DetailDialog "History" buttons)
// =========================================================================
export function generatePaymentHistory(
  title: string,
  ownerInfo: Array<[string, string]>,
  entries: LedgerEntry[],
  summary: Array<[string, string, string?]>
) {
  const doc = new jsPDF();
  header(doc, "Payment History");

  let y = 44;
  y = fromAndTo(doc, y, title, ownerInfo.slice(0, 4).map(([k, v]) => [k, v] as [string, string]));

  const cards: Array<[string, string, "ink" | "success" | "danger" | "gold"]> = summary.slice(0, 4).map(([l, v, c]) => [
    l, v,
    (c === "success" ? "success" : c === "destructive" ? "danger" : c === "gold" ? "gold" : "ink"),
  ]);
  y = summaryCards(doc, y, cards);
  y += 2;

  sectionTitle(doc, "Transaction History", y); y += 4;
  let running = 0;
  brandTable(doc, {
    startY: y + 1,
    head: [["Date", "Receipt", "Description", "Type", "Amount", "Running"]],
    body: entries.map((e) => {
      running += e.amount;
      return [
        fmtDate(e.date), e.id, e.note || e.referenceName, labelType(e.type),
        { content: formatCurrency(e.amount), styles: { halign: "right" as const } },
        { content: formatCurrency(running), styles: { halign: "right" as const, textColor: NAVY } },
      ];
    }),
  });

  footer(doc);
  save(doc, `Avery_Payment_History_${title.replace(/\s+/g, "_")}.pdf`);
}

// =========================================================================
//  INVOICE
// =========================================================================
export function generateInvoice(booking: Booking, clients: Client[], agent?: Agent, supplier?: Supplier) {
  const doc = new jsPDF();
  header(doc, "Tax Invoice");

  let y = 44;
  y = fromAndTo(doc, y, "Bill To", [
    ["Head ID", booking.headId],
    ["Lead", clients[0] ? getClientName(clients[0]) : "—"],
    ["Phone", clients[0]?.phone || "—"],
    ["Members", String(booking.members || clients.length)],
  ]);

  // Meta strip
  doc.setFillColor(...NAVY);
  doc.rect(14, y, 182, 7, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Invoice #INV-${booking.headId.replace("AV-HD-", "")}   ·   Package: ${booking.packageType}`, 18, y + 5);
  doc.text(`Travel: ${fmtDate(booking.travelDate)}`, 192, y + 5, { align: "right" });
  doc.setTextColor(...INK);
  y += 11;

  sectionTitle(doc, "Client Breakdown", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Client ID", "Name", "Passport", "Due", "Paid", "Status"]],
    body: clients.map((c, i) => [
      String(i + 1), c.id, getClientName(c), c.passport || "—",
      { content: formatCurrency(c.amountDue), styles: { halign: "right" as const } },
      { content: formatCurrency(c.amountPaid), styles: { halign: "right" as const, textColor: SUCCESS } },
      c.paymentStatus,
    ]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Service sections embedded in invoice if any
  y = renderServiceSections(doc, y, [booking]);

  const balance = booking.totalAmount - booking.amountReceived;
  // Right-aligned totals box
  doc.setFillColor(...IVORY);
  doc.rect(110, y, 86, 32, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(110, y, 86, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Total Amount", 114, y + 7);
  doc.text(formatCurrency(booking.totalAmount), 192, y + 7, { align: "right" });
  doc.text("Received", 114, y + 14);
  doc.setTextColor(...SUCCESS);
  doc.text(formatCurrency(booking.amountReceived), 192, y + 14, { align: "right" });
  doc.setTextColor(...INK);

  doc.setFillColor(...GOLD);
  doc.rect(110, y + 19, 86, 13, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("BALANCE DUE", 114, y + 27.5);
  doc.text(formatCurrency(balance), 192, y + 27.5, { align: "right" });

  if (agent || supplier) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Agent: ${agent?.name || "Direct"}   ·   Supplier: ${supplier?.companyName || "—"}`, 14, y + 36);
  }

  footer(doc);
  save(doc, `Avery_Invoice_${booking.headId}.pdf`);
}

// =========================================================================
//  PAYMENT RECEIPT
// =========================================================================
export function generatePaymentReceipt(entry: LedgerEntry, opts?: { clientName?: string; method?: string; handledBy?: string; reference?: string }) {
  const doc = new jsPDF();
  header(doc, "Payment Receipt");

  let y = 44;
  y = fromAndTo(doc, y, "Received From", [
    ["Name", opts?.clientName || entry.referenceName],
    ["Reference", opts?.reference || entry.headId || "—"],
    ["Receipt #", entry.id],
    ["Date", fmtDate(entry.date)],
  ]);

  brandTable(doc, {
    startY: y,
    head: [["Description", "Method", "Handled By", "Amount (PKR)"]],
    body: [[entry.note || "Payment received", opts?.method || "Cash / Bank Transfer", opts?.handledBy || "Avery Office", { content: formatCurrency(entry.amount).replace("PKR", "").trim(), styles: { halign: "right" as const } }]],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  totalsBand(doc, y, "Total Received", formatCurrency(entry.amount));
  y += 18;

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(20, y + 6, 80, y + 6);
  doc.line(130, y + 6, 190, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Authorized Signature", 30, y + 11);
  doc.text("Company Stamp", 145, y + 11);

  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text("This is a computer-generated receipt and does not require a physical signature.", 14, y + 22);

  footer(doc);
  save(doc, `Avery_Payment_Receipt_${entry.id}.pdf`);
}

// =========================================================================
//  VOUCHERS — Hotel / Flight / Transport
// =========================================================================
export function generateHotelVoucher(booking: Booking, clients: Client[], hotels: HotelService[], opts?: { transports?: TransportService[]; flights?: FlightService[]; voucherSuffix?: string }) {
  const doc = new jsPDF();
  const subtitle = booking.packageType === "Umrah" ? "Umrah Hotel Voucher" : booking.packageType === "Hajj" ? "Hajj Hotel Voucher" : "Hotel Voucher";
  header(doc, subtitle);

  let y = 44;
  y = fromAndTo(doc, y, "Guest Booking", [
    ["Head ID", booking.headId],
    ["Voucher #", `AV-${booking.headId.replace(/[^0-9]/g, "")}${opts?.voucherSuffix || ""}`],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Members", String(clients.length)],
  ]);

  sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Passenger Name", "Passport No", "Type"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—", "Adult"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (hotels.length) {
    sectionTitle(doc, "Accommodation", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["City", "Hotel Name", "Room", "Check-In", "Check-Out", "Nights"]],
      body: hotels.map((h) => [h.city, h.hotelName, h.roomType, fmtDate(h.checkIn), fmtDate(h.checkOut), String(h.nights)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (opts?.transports?.length) {
    sectionTitle(doc, "Transport", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Service", "Route", "Vehicle", "Date"]],
      body: opts.transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (opts?.flights?.length) {
    sectionTitle(doc, "Flights", y); y += 4;
    brandTable(doc, {
      startY: y + 1,
      head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
      body: opts.flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
    });
  }

  footer(doc);
  const cityTag = hotels.length === 1 ? `_${hotels[0].city}` : hotels.length > 1 ? "_All" : "";
  save(doc, `Avery_Hotel_Voucher_${booking.headId}${cityTag}.pdf`);
}

export function generateFlightVoucher(booking: Booking, clients: Client[], flights: FlightService[]) {
  const doc = new jsPDF();
  header(doc, "Flight Voucher");
  let y = 44;
  y = fromAndTo(doc, y, "Booking", [
    ["Head ID", booking.headId],
    ["Voucher #", `AV-FL-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Members", String(clients.length)],
  ]);
  sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  sectionTitle(doc, "Flights", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
    body: flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
  });
  footer(doc);
  save(doc, `Avery_Flight_Voucher_${booking.headId}.pdf`);
}

export function generateTransportVoucher(booking: Booking, clients: Client[], transports: TransportService[]) {
  const doc = new jsPDF();
  header(doc, "Transport Voucher");
  let y = 44;
  y = fromAndTo(doc, y, "Booking", [
    ["Head ID", booking.headId],
    ["Voucher #", `AV-TR-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Members", String(clients.length)],
  ]);
  sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;
  sectionTitle(doc, "Transport", y); y += 4;
  brandTable(doc, {
    startY: y + 1,
    head: [["Service", "Route", "Vehicle", "Date"]],
    body: transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
  });
  footer(doc);
  save(doc, `Avery_Transport_Voucher_${booking.headId}.pdf`);
}