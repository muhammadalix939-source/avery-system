import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, getClientName } from "./data";
import type { Client, Agent, Supplier, Booking, HotelService, FlightService, TransportService } from "./data";
import type { LedgerEntry } from "./store";

// ============================================================
//  AVERY INTERNATIONAL — Navy + Gold Professional PDF Template
// ============================================================

const COMPANY = "AVERY INTERNATIONAL TRAVEL & TOURS";
const COMPANY_TAGLINE = "Umrah & International Travel Specialists, serving worldwide…";
const COMPANY_ADDR = "IBM Center, Paper Market, Office 204, Karachi";
const COMPANY_PHONE = "0330-2793701  |  0310-2326386  |  0322-3241659";
const COMPANY_EMAIL = "averyinternationaltraveltours@gmail.com";

// Brand palette (navy + gold)
const NAVY: [number, number, number] = [11, 24, 56];          // deep navy
const NAVY_SOFT: [number, number, number] = [27, 42, 78];
const GOLD: [number, number, number] = [191, 149, 63];        // primary gold
const GOLD_SOFT: [number, number, number] = [217, 188, 122];
const INK: [number, number, number] = [25, 32, 50];
const MUTED: [number, number, number] = [110, 116, 130];
const ROW_ALT: [number, number, number] = [248, 246, 240];
const WHITE: [number, number, number] = [255, 255, 255];

function header(doc: jsPDF, title: string) {
  // Top navy band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 30, "F");
  // Gold accent stripe
  doc.setFillColor(...GOLD);
  doc.rect(0, 30, 210, 1.5, "F");

  // Logo placeholder — gold "A" monogram in circle
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.circle(20, 15, 8);
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("A", 20, 18.5, { align: "center" });

  // Company name
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(COMPANY, 33, 14);

  // Tagline
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD_SOFT);
  doc.text(COMPANY_TAGLINE, 33, 19.5);

  // Right side — title + date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), 196, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_SOFT);
  const now = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(now, 196, 19.5, { align: "right" });

  doc.setTextColor(...INK);
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(text.toUpperCase(), 14, y);
  // gold underline
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, 60, y + 1.5);
  doc.setTextColor(...INK);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Gold accent line above footer
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(14, 275, 196, 275);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(COMPANY_ADDR, 14, 280);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(COMPANY_PHONE, 14, 284);
    doc.text(COMPANY_EMAIL, 14, 288);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...GOLD);
    doc.text("Avery International — Your Journey Begins with Trust…", 196, 284, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pages}`, 196, 288, { align: "right" });
  }
}

// Standard table styling (navy header)
function brandTable(doc: jsPDF, opts: Parameters<typeof autoTable>[1]) {
  autoTable(doc, {
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: "bold", halign: "left" },
    bodyStyles: { fontSize: 9, textColor: INK, cellPadding: 3 },
    alternateRowStyles: { fillColor: ROW_ALT },
    styles: { lineColor: [220, 215, 200], lineWidth: 0.2 },
    margin: { left: 14, right: 14 },
    ...opts,
  });
}

// Meta info strip (Voucher No / Issue Date etc)
function metaStrip(doc: jsPDF, y: number, items: Array<[string, string]>) {
  brandTable(doc, {
    startY: y,
    body: items.map(([k, v]) => [{ content: k, styles: { fontStyle: "bold", fillColor: ROW_ALT, cellWidth: 40 } }, v]),
    theme: "grid",
  });
  return (doc as any).lastAutoTable.finalY;
}

function save(doc: jsPDF, name: string) {
  doc.save(name.replace(/\s+/g, "_"));
}

// ============================================================
//  HOTEL VOUCHER — one hotel per voucher OR all combined
// ============================================================
export function generateHotelVoucher(booking: Booking, clients: Client[], hotels: HotelService[], opts?: { transports?: TransportService[]; flights?: FlightService[]; voucherSuffix?: string }) {
  const doc = new jsPDF();
  const subtitle = booking.packageType === "Umrah" ? "UMRAH HOTEL VOUCHER" : booking.packageType === "Hajj" ? "HAJJ HOTEL VOUCHER" : "HOTEL VOUCHER";
  header(doc, subtitle);

  let y = 40;
  sectionTitle(doc, subtitle, y);
  y += 4;

  const voucherNo = `AV-${booking.headId.replace(/[^0-9]/g, "")}${opts?.voucherSuffix || ""}`;
  y = metaStrip(doc, y + 2, [
    ["Voucher No", voucherNo],
    ["Booking", booking.headId],
    ["Issue Date", new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ]) + 6;

  // Passengers
  sectionTitle(doc, "Passenger Details", y);
  y += 4;
  brandTable(doc, {
    startY: y + 2,
    head: [["S#", "Passenger Name", "Passport No", "Type"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—", "Adult"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Accommodation
  if (hotels.length > 0) {
    sectionTitle(doc, "Accommodation Details", y);
    y += 4;
    brandTable(doc, {
      startY: y + 2,
      head: [["City", "Hotel Name", "Room", "Check-In", "Check-Out", "Nights"]],
      body: hotels.map((h) => [h.city, h.hotelName, h.roomType, fmtDate(h.checkIn), fmtDate(h.checkOut), String(h.nights)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Transport (optional)
  if (opts?.transports && opts.transports.length > 0) {
    sectionTitle(doc, "Transport Details", y);
    y += 4;
    brandTable(doc, {
      startY: y + 2,
      head: [["Service", "Route", "Vehicle", "Date"]],
      body: opts.transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Flights (optional)
  if (opts?.flights && opts.flights.length > 0) {
    sectionTitle(doc, "Flight Details", y);
    y += 4;
    brandTable(doc, {
      startY: y + 2,
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
  header(doc, "FLIGHT VOUCHER");
  let y = 40;
  sectionTitle(doc, "Flight Voucher", y);
  y += 4;
  y = metaStrip(doc, y + 2, [
    ["Voucher No", `AV-FL-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Booking", booking.headId],
    ["Issue Date", new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ]) + 6;

  sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 2,
    head: [["S#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  sectionTitle(doc, "Flight Details", y); y += 4;
  brandTable(doc, {
    startY: y + 2,
    head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
    body: flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
  });

  footer(doc);
  save(doc, `Avery_Flight_Voucher_${booking.headId}.pdf`);
}

export function generateTransportVoucher(booking: Booking, clients: Client[], transports: TransportService[]) {
  const doc = new jsPDF();
  header(doc, "TRANSPORT VOUCHER");
  let y = 40;
  sectionTitle(doc, "Transport Voucher", y); y += 4;
  y = metaStrip(doc, y + 2, [
    ["Voucher No", `AV-TR-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Booking", booking.headId],
    ["Issue Date", new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ]) + 6;

  sectionTitle(doc, "Passenger Details", y); y += 4;
  brandTable(doc, {
    startY: y + 2,
    head: [["S#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  sectionTitle(doc, "Transport Details", y); y += 4;
  brandTable(doc, {
    startY: y + 2,
    head: [["Service", "Route", "Vehicle", "Date"]],
    body: transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
  });

  footer(doc);
  save(doc, `Avery_Transport_Voucher_${booking.headId}.pdf`);
}

// ============================================================
//  PAYMENT RECEIPT
// ============================================================
export function generatePaymentReceipt(entry: LedgerEntry, opts?: { clientName?: string; method?: string; handledBy?: string; reference?: string }) {
  const doc = new jsPDF();
  header(doc, "PAYMENT RECEIPT");

  let y = 42;
  sectionTitle(doc, "Payment Receipt", y);
  y += 6;

  brandTable(doc, {
    startY: y,
    body: [
      [{ content: "Receipt No", styles: { fontStyle: "bold", fillColor: ROW_ALT } }, entry.id, { content: "Date", styles: { fontStyle: "bold", fillColor: ROW_ALT } }, fmtDate(entry.date)],
      [{ content: "Received From", styles: { fontStyle: "bold", fillColor: ROW_ALT } }, opts?.clientName || entry.referenceName, { content: "Payment Method", styles: { fontStyle: "bold", fillColor: ROW_ALT } }, opts?.method || "Cash / Bank Transfer"],
      [{ content: "Reference", styles: { fontStyle: "bold", fillColor: ROW_ALT } }, opts?.reference || entry.headId || "—", { content: "Handled By", styles: { fontStyle: "bold", fillColor: ROW_ALT } }, opts?.handledBy || "Avery Office"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  brandTable(doc, {
    startY: y,
    head: [["Description", "Amount (PKR)"]],
    body: [[entry.note || "Payment received", { content: formatCurrency(entry.amount).replace("PKR", "").trim(), styles: { halign: "right" } }]],
    columnStyles: { 1: { halign: "right", cellWidth: 50 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Total band — gold
  doc.setFillColor(...GOLD);
  doc.rect(14, y, 182, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL RECEIVED", 18, y + 8);
  doc.text(formatCurrency(entry.amount), 192, y + 8, { align: "right" });

  y += 30;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(20, y, 80, y);
  doc.line(130, y, 190, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Authorized Signature", 30, y + 5);
  doc.text("Company Stamp", 145, y + 5);

  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text("This is a computer-generated receipt and does not require a physical signature.", 14, y + 18);

  footer(doc);
  save(doc, `Avery_Payment_Receipt_${entry.id}.pdf`);
}

// ============================================================
//  PAYMENT HISTORY (multi-row, full ledger view)
// ============================================================
export function generatePaymentHistory(title: string, ownerInfo: Array<[string, string]>, entries: LedgerEntry[], summary: Array<[string, string, string?]>) {
  const doc = new jsPDF();
  header(doc, "PAYMENT HISTORY");

  let y = 40;
  sectionTitle(doc, title, y);
  y += 4;
  y = metaStrip(doc, y + 2, ownerInfo) + 6;

  // Summary cards row (gold/navy bands)
  const cardW = 60, cardH = 16, gap = 1;
  summary.slice(0, 3).forEach(([label, value, color], i) => {
    const x = 14 + i * (cardW + gap);
    doc.setFillColor(...NAVY);
    doc.rect(x, y, cardW, 5, "F");
    doc.setFillColor(...ROW_ALT);
    doc.rect(x, y + 5, cardW, cardH - 5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 3, y + 3.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(color === "success" ? 0 : color === "destructive" ? 180 : NAVY[0], color === "success" ? 130 : color === "destructive" ? 30 : NAVY[1], color === "success" ? 60 : color === "destructive" ? 30 : NAVY[2]);
    doc.text(value, x + 3, y + 13);
  });
  y += cardH + 8;

  doc.setTextColor(...INK);
  sectionTitle(doc, "Transaction History", y); y += 4;

  let running = 0;
  brandTable(doc, {
    startY: y + 2,
    head: [["Date", "Receipt", "Description", "Type", "Amount", "Running"]],
    body: entries.map((e) => {
      running += e.amount;
      return [
        fmtDate(e.date),
        e.id,
        e.note || e.referenceName,
        labelType(e.type),
        { content: formatCurrency(e.amount), styles: { halign: "right" as const } },
        { content: formatCurrency(running), styles: { halign: "right" as const, textColor: NAVY } },
      ];
    }),
  });

  footer(doc);
  save(doc, `Avery_Payment_History_${title.replace(/\s+/g, "_")}.pdf`);
}

// ============================================================
//  INVOICE
// ============================================================
export function generateInvoice(booking: Booking, clients: Client[], agent?: Agent, supplier?: Supplier) {
  const doc = new jsPDF();
  header(doc, "INVOICE");

  let y = 40;
  sectionTitle(doc, "Tax Invoice", y);
  y += 4;
  y = metaStrip(doc, y + 2, [
    ["Invoice No", `INV-${booking.headId.replace("AV-HD-", "")}`],
    ["Booking", booking.headId],
    ["Package", booking.packageType],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Agent", agent ? `${agent.name} (${agent.id})` : "Direct"],
    ["Supplier", supplier ? `${supplier.companyName} (${supplier.id})` : "—"],
  ]) + 6;

  sectionTitle(doc, "Client Breakdown", y); y += 4;
  brandTable(doc, {
    startY: y + 2,
    head: [["#", "Client ID", "Name", "Passport", "Due", "Paid", "Status"]],
    body: clients.map((c, i) => [
      String(i + 1), c.id, getClientName(c), c.passport || "—",
      { content: formatCurrency(c.amountDue), styles: { halign: "right" as const } },
      { content: formatCurrency(c.amountPaid), styles: { halign: "right" as const, textColor: [0, 130, 60] as [number, number, number] } },
      c.paymentStatus,
    ]),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Totals card
  const balance = booking.totalAmount - booking.amountReceived;
  doc.setFillColor(...ROW_ALT);
  doc.rect(110, y, 86, 30, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(110, y, 196, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text("Total Amount", 114, y + 7);
  doc.text(formatCurrency(booking.totalAmount), 192, y + 7, { align: "right" });
  doc.text("Received", 114, y + 14);
  doc.setTextColor(0, 130, 60);
  doc.text(formatCurrency(booking.amountReceived), 192, y + 14, { align: "right" });

  // Balance gold band
  doc.setFillColor(...GOLD);
  doc.rect(110, y + 18, 86, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BALANCE DUE", 114, y + 26);
  doc.text(formatCurrency(balance), 192, y + 26, { align: "right" });

  footer(doc);
  save(doc, `Avery_Invoice_${booking.headId}.pdf`);
}

// ============================================================
//  CLIENT STATEMENT
// ============================================================
export function generateClientStatement(client: Client, entries: LedgerEntry[]) {
  const doc = new jsPDF();
  header(doc, "CLIENT STATEMENT");

  let y = 40;
  sectionTitle(doc, "Client Statement", y); y += 4;
  y = metaStrip(doc, y + 2, [
    ["Client ID", client.id],
    ["Name", getClientName(client)],
    ["Head ID", client.headId],
    ["Passport", client.passport || "—"],
    ["Phone", client.phone],
    ["Package", client.packageType],
  ]) + 6;

  // Summary tri-card
  const remaining = client.amountDue - client.amountPaid;
  drawSummaryRow(doc, y, [
    ["Total Due", formatCurrency(client.amountDue), "ink"],
    ["Paid", formatCurrency(client.amountPaid), "success"],
    ["Remaining", formatCurrency(remaining), "destructive"],
  ]);
  y += 22;

  if (entries.length > 0) {
    sectionTitle(doc, "Transaction History", y); y += 4;
    brandTable(doc, {
      startY: y + 2,
      head: [["Date", "Receipt", "Description", "Amount"]],
      body: entries.map((e) => [fmtDate(e.date), e.id, e.note || e.referenceName, { content: formatCurrency(e.amount), styles: { halign: "right" as const, textColor: [0, 130, 60] as [number, number, number] } }]),
    });
  }

  footer(doc);
  save(doc, `Avery_Statement_${client.id}.pdf`);
}

// ============================================================
//  SUPPLIER LEDGER
// ============================================================
export function generateSupplierLedger(supplier: Supplier, entries: LedgerEntry[]) {
  const doc = new jsPDF();
  header(doc, "SUPPLIER LEDGER");

  let y = 40;
  sectionTitle(doc, "Supplier Ledger", y); y += 4;
  y = metaStrip(doc, y + 2, [
    ["Supplier ID", supplier.id],
    ["Company", supplier.companyName],
    ["Contact", supplier.contactPerson],
    ["Service", supplier.serviceType],
    ["Phone", supplier.phone],
    ["Email", supplier.email],
  ]) + 6;

  const remaining = supplier.totalPayable - supplier.totalPaid;
  drawSummaryRow(doc, y, [
    ["Total Payable", formatCurrency(supplier.totalPayable), "ink"],
    ["Total Paid", formatCurrency(supplier.totalPaid), "success"],
    ["Remaining", formatCurrency(remaining), "destructive"],
  ]);
  y += 22;

  if (entries.length > 0) {
    sectionTitle(doc, "Payment History", y); y += 4;
    brandTable(doc, {
      startY: y + 2,
      head: [["Date", "Receipt", "Reference", "Note", "Amount"]],
      body: entries.map((e) => [fmtDate(e.date), e.id, e.headId || "—", e.note, { content: formatCurrency(e.amount), styles: { halign: "right" as const } }]),
    });
  }

  footer(doc);
  save(doc, `Avery_Supplier_Ledger_${supplier.id}.pdf`);
}

// ============================================================
//  AGENT REPORT
// ============================================================
export function generateAgentReport(agent: Agent, entries: LedgerEntry[]) {
  const doc = new jsPDF();
  header(doc, "AGENT REPORT");

  let y = 40;
  sectionTitle(doc, "Agent Performance", y); y += 4;
  y = metaStrip(doc, y + 2, [
    ["Agent ID", agent.id],
    ["Name", agent.name],
    ["Phone", agent.phone],
    ["Email", agent.email],
    ["Status", agent.status],
  ]) + 6;

  const payable = (agent.commission || 0) - (agent.paidCommission || 0);
  drawSummaryRow(doc, y, [
    ["Total Sales", formatCurrency(agent.totalSales), "ink"],
    ["Commission", formatCurrency(agent.commission), "ink"],
    ["Paid", formatCurrency(agent.paidCommission || 0), "success"],
  ]);
  y += 22;
  drawSummaryRow(doc, y, [
    ["Payable", formatCurrency(payable), "destructive"],
    ["Total Clients", String(agent.totalClients), "ink"],
    ["", "", "ink"],
  ]);
  y += 22;

  if (entries.length > 0) {
    sectionTitle(doc, "Commission History", y); y += 4;
    brandTable(doc, {
      startY: y + 2,
      head: [["Date", "Receipt", "Note", "Amount"]],
      body: entries.map((e) => [fmtDate(e.date), e.id, e.note, { content: formatCurrency(e.amount), styles: { halign: "right" as const, textColor: [0, 130, 60] as [number, number, number] } }]),
    });
  }

  footer(doc);
  save(doc, `Avery_Agent_Report_${agent.id}.pdf`);
}

// ============================================================
//  Shared helpers
// ============================================================
function drawSummaryRow(doc: jsPDF, y: number, cards: Array<[string, string, "ink" | "success" | "destructive"]>) {
  const cardW = 60, gap = 1;
  cards.forEach(([label, value, tone], i) => {
    if (!label) return;
    const x = 14 + i * (cardW + gap);
    doc.setFillColor(...NAVY);
    doc.rect(x, y, cardW, 5, "F");
    doc.setFillColor(...ROW_ALT);
    doc.rect(x, y + 5, cardW, 17, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 3, y + 3.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (tone === "success") doc.setTextColor(0, 130, 60);
    else if (tone === "destructive") doc.setTextColor(180, 30, 30);
    else doc.setTextColor(...NAVY);
    doc.text(value, x + 3, y + 14);
  });
  doc.setTextColor(...INK);
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
    case "supplier_payment": return "Supplier";
    case "agent_commission": return "Commission";
    case "expense": return "Expense";
    default: return t;
  }
}