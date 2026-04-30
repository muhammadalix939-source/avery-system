import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, getClientName } from "./data";
import type { Client, Agent, Supplier, Booking, HotelService, FlightService, TransportService } from "./data";
import type { LedgerEntry } from "./store";

// ============================================================
//  AVERY INTERNATIONAL — Premium Clean Corporate PDF System
//  Inspired by airline tickets + embassy paperwork
// ============================================================

const COMPANY = "Avery Group of Travel";
const COMPANY_FULL = "Avery International Travel & Tours";
const TAGLINE = "Umrah & International Travel Specialists, serving worldwide…";
const TAGLINE_ALT = "Umrah · Hajj · Visa · Flights · Domestic & International Tours…";
const ADDR = "IBM Center, Paper Market, Office 204, Karachi";
const PHONES = "0330-2793701  |  0310-2326386  |  0322-3241659";
const EMAIL = "averyinternationaltraveltours@gmail.com";
const FOOTER_TAGLINE = "Your Journey Begins With Trust";

// Strict palette
const NAVY: [number, number, number] = [11, 31, 58];          // #0B1F3A
const GOLD: [number, number, number] = [200, 169, 106];       // #C8A96A
const INK: [number, number, number] = [34, 34, 34];           // #222222
const MUTED: [number, number, number] = [102, 102, 102];      // #666666
const DIVIDER: [number, number, number] = [229, 229, 229];    // #E5E5E5
const TABLE_HEAD_BG: [number, number, number] = [247, 247, 247]; // #F7F7F7
const WHITE: [number, number, number] = [255, 255, 255];

// Page geometry (A4 = 210 x 297 mm). Use mm units (jsPDF default).
const PAGE_W = 210;
const MARGIN_L = 14;   // ~ 35px @ ~96dpi feel within A4
const MARGIN_R = 14;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

// ----------------------------------------------------------------
// Header: brand left, document title right, gold divider underneath
// ----------------------------------------------------------------
function header(doc: jsPDF, title: string) {
  // Brand block (left)
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(COMPANY.toUpperCase(), MARGIN_L, 20);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(TAGLINE, MARGIN_L, 25.5);

  // Document title (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text(title.toUpperCase(), PAGE_W - MARGIN_R, 21, { align: "right" });

  // Thin gold divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_L, 31, PAGE_W - MARGIN_R, 31);

  doc.setTextColor(...INK);
}

// ----------------------------------------------------------------
// Section title: uppercase, gold underline accent
// ----------------------------------------------------------------
function section(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(text.toUpperCase(), MARGIN_L, y);

  // small gold underline (left accent)
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  const w = Math.min(28, doc.getTextWidth(text.toUpperCase()) * 0.45);
  doc.line(MARGIN_L, y + 1.6, MARGIN_L + w, y + 1.6);
  doc.setTextColor(...INK);
  return y + 6;
}

// ----------------------------------------------------------------
// Footer: divider line, contacts row, tagline
// ----------------------------------------------------------------
function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // Divider
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, 274, PAGE_W - MARGIN_R, 274);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    // Left: phones
    doc.text(PHONES, MARGIN_L, 280);
    // Right: email
    doc.text(EMAIL, PAGE_W - MARGIN_R, 280, { align: "right" });
    // Center: address
    doc.text(ADDR, PAGE_W / 2, 280, { align: "center" });

    // Tagline center
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(FOOTER_TAGLINE, PAGE_W / 2, 287, { align: "center" });

    // Page no
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN_R, 291, { align: "right" });
  }
}

// ----------------------------------------------------------------
// Clean table (minimal: only bottom borders on header & rows)
// ----------------------------------------------------------------
function table(doc: jsPDF, opts: Parameters<typeof autoTable>[1]) {
  autoTable(doc, {
    theme: "plain",
    headStyles: {
      fillColor: TABLE_HEAD_BG,
      textColor: NAVY,
      fontSize: 10,
      fontStyle: "bold",
      halign: "left",
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineColor: DIVIDER,
      lineWidth: { bottom: 0.4, top: 0, left: 0, right: 0 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineColor: DIVIDER,
      lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
    },
    styles: { font: "helvetica" },
    margin: { left: MARGIN_L, right: MARGIN_R },
    ...opts,
  });
}

// Meta info inline strip — label/value pairs in two columns, no heavy borders
function metaBlock(doc: jsPDF, y: number, items: Array<[string, string]>): number {
  const colW = CONTENT_W / 2;
  const rowH = 6;
  let row = 0;
  doc.setFontSize(10);
  items.forEach((it, idx) => {
    const col = idx % 2;
    if (col === 0 && idx > 0) row++;
    const x = MARGIN_L + col * colW;
    const yy = y + row * rowH;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(`${it[0]}:`, x, yy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.text(it[1] || "—", x + 32, yy);
  });
  const totalRows = Math.ceil(items.length / 2);
  return y + totalRows * rowH + 2;
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

function todayLong(): string {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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

// ============================================================
//  HOTEL VOUCHER
// ============================================================
export function generateHotelVoucher(
  booking: Booking,
  clients: Client[],
  hotels: HotelService[],
  opts?: { transports?: TransportService[]; flights?: FlightService[]; voucherSuffix?: string }
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const title = booking.packageType === "Umrah" ? "Umrah Hotel Voucher" : booking.packageType === "Hajj" ? "Hajj Hotel Voucher" : "Hotel Voucher";
  header(doc, title);

  let y = 42;

  const voucherNo = `AV-${booking.headId.replace(/[^0-9]/g, "")}${opts?.voucherSuffix || ""}`;
  // Sub meta line under header (right aligned)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Voucher No: `, MARGIN_L, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(voucherNo, MARGIN_L + 22, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Booking: `, MARGIN_L + 75, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(booking.headId, MARGIN_L + 92, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Issue Date: `, PAGE_W - MARGIN_R - 45, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(todayLong(), PAGE_W - MARGIN_R, y, { align: "right" });

  y += 10;

  // Passenger details
  y = section(doc, "Passenger Details", y);
  table(doc, {
    startY: y,
    head: [["S#", "Passenger Name", "Passport No", "Type"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—", "Adult"]),
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 40 }, 3: { cellWidth: 25, halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (hotels.length > 0) {
    y = section(doc, "Accommodation Details", y);
    table(doc, {
      startY: y,
      head: [["City", "Hotel Name", "Room", "Check-In", "Check-Out", "Nights"]],
      body: hotels.map((h) => [h.city, h.hotelName, h.roomType, fmtDate(h.checkIn), fmtDate(h.checkOut), String(h.nights)]),
      columnStyles: {
        3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center", cellWidth: 18 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (opts?.transports && opts.transports.length > 0) {
    y = section(doc, "Transport Details", y);
    table(doc, {
      startY: y,
      head: [["Service", "Route", "Vehicle", "Date"]],
      body: opts.transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
      columnStyles: { 3: { halign: "center", cellWidth: 30 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (opts?.flights && opts.flights.length > 0) {
    y = section(doc, "Flight Details", y);
    table(doc, {
      startY: y,
      head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
      body: opts.flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
      columnStyles: {
        0: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" },
      },
    });
  }

  footer(doc);
  const cityTag = hotels.length === 1 ? `_${hotels[0].city}` : hotels.length > 1 ? "_All" : "";
  save(doc, `Avery_Hotel_Voucher_${booking.headId}${cityTag}.pdf`);
}

// ============================================================
//  FLIGHT VOUCHER
// ============================================================
export function generateFlightVoucher(booking: Booking, clients: Client[], flights: FlightService[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Flight Voucher");
  let y = 42;
  y = metaBlock(doc, y, [
    ["Voucher No", `AV-FL-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Issue Date", todayLong()],
    ["Booking", booking.headId],
    ["Package", booking.packageType],
  ]) + 4;

  y = section(doc, "Passenger Details", y);
  table(doc, {
    startY: y,
    head: [["S#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 40 } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = section(doc, "Flight Details", y);
  table(doc, {
    startY: y,
    head: [["Date", "Flight", "From", "To", "Departure", "Arrival"]],
    body: flights.map((f) => [fmtDate(f.date), f.flightNo, f.from, f.to, f.departure, f.arrival]),
    columnStyles: { 0: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
  });

  footer(doc);
  save(doc, `Avery_Flight_Voucher_${booking.headId}.pdf`);
}

// ============================================================
//  TRANSPORT VOUCHER
// ============================================================
export function generateTransportVoucher(booking: Booking, clients: Client[], transports: TransportService[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Transport Voucher");
  let y = 42;
  y = metaBlock(doc, y, [
    ["Voucher No", `AV-TR-${booking.headId.replace(/[^0-9]/g, "")}`],
    ["Issue Date", todayLong()],
    ["Booking", booking.headId],
    ["Package", booking.packageType],
  ]) + 4;

  y = section(doc, "Passenger Details", y);
  table(doc, {
    startY: y,
    head: [["S#", "Passenger Name", "Passport No"]],
    body: clients.map((c, i) => [String(i + 1), getClientName(c), c.passport || "—"]),
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 40 } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = section(doc, "Transport Details", y);
  table(doc, {
    startY: y,
    head: [["Service", "Route", "Vehicle", "Date"]],
    body: transports.map((t) => [t.service, t.route, t.vehicle, fmtDate(t.date)]),
    columnStyles: { 3: { halign: "center", cellWidth: 30 } },
  });

  footer(doc);
  save(doc, `Avery_Transport_Voucher_${booking.headId}.pdf`);
}

// ============================================================
//  PAYMENT RECEIPT
// ============================================================
export function generatePaymentReceipt(
  entry: LedgerEntry,
  opts?: { clientName?: string; method?: string; handledBy?: string; reference?: string }
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Payment Receipt");

  let y = 42;
  y = metaBlock(doc, y, [
    ["Receipt No", entry.id],
    ["Date", fmtDate(entry.date)],
    ["Received From", opts?.clientName || entry.referenceName],
    ["Payment Method", opts?.method || "Cash / Bank Transfer"],
    ["Reference", opts?.reference || entry.headId || "—"],
    ["Handled By", opts?.handledBy || "Avery Office"],
  ]) + 6;

  y = section(doc, "Payment Details", y);
  table(doc, {
    startY: y,
    head: [["Description", "Amount (PKR)"]],
    body: [[
      entry.note || "Payment received",
      { content: formatCurrency(entry.amount).replace("PKR", "").trim(), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    ]],
    columnStyles: { 1: { halign: "right", cellWidth: 50 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Right-aligned grand total
  const boxX = PAGE_W - MARGIN_R - 80;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(boxX, y, PAGE_W - MARGIN_R, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("Total Received", boxX, y);
  doc.text(formatCurrency(entry.amount), PAGE_W - MARGIN_R, y, { align: "right" });
  y += 18;

  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L + 6, y, MARGIN_L + 60, y);
  doc.line(PAGE_W - MARGIN_R - 60, y, PAGE_W - MARGIN_R - 6, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Authorized Signature", MARGIN_L + 6, y + 5);
  doc.text("Company Stamp", PAGE_W - MARGIN_R - 60, y + 5);

  doc.setFontSize(8);
  doc.text("This is a computer-generated receipt and does not require a physical signature.", MARGIN_L, y + 16);

  footer(doc);
  save(doc, `Avery_Payment_Receipt_${entry.id}.pdf`);
}

// ============================================================
//  PAYMENT HISTORY
// ============================================================
export function generatePaymentHistory(
  title: string,
  ownerInfo: Array<[string, string]>,
  entries: LedgerEntry[],
  summary: Array<[string, string, string?]>
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Payment History");

  let y = 42;
  y = metaBlock(doc, y, ownerInfo) + 4;

  y = section(doc, "Summary", y);
  // Three clean summary cells
  const cellW = CONTENT_W / 3;
  summary.slice(0, 3).forEach(([label, value], i) => {
    if (!label) return;
    const x = MARGIN_L + i * cellW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(value, x, y + 6);
  });
  // gold underline beneath summary row
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, y + 11, PAGE_W - MARGIN_R, y + 11);
  y += 18;

  y = section(doc, "Transaction History", y);
  let running = 0;
  table(doc, {
    startY: y,
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
    columnStyles: { 0: { halign: "center", cellWidth: 24 }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  footer(doc);
  save(doc, `Avery_Payment_History_${title.replace(/\s+/g, "_")}.pdf`);
}

// ============================================================
//  OFFICIAL INVOICE
// ============================================================
export function generateInvoice(booking: Booking, clients: Client[], agent?: Agent, supplier?: Supplier) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Official Invoice");

  let y = 42;
  const invoiceNo = `AV-IN${booking.headId.replace(/[^0-9]/g, "")}`;
  const primary = clients[0];

  // Top meta block — invoice info
  y = metaBlock(doc, y, [
    ["Invoice No", invoiceNo],
    ["Issue Date", todayLong()],
    ["Booking", booking.headId],
    ["Package", booking.packageType],
    ["Travel Date", fmtDate(booking.travelDate)],
    ["Agent", agent ? `${agent.name} (${agent.id})` : "Direct"],
  ]) + 4;

  // Bill To block
  y = section(doc, "Bill To", y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(primary ? getClientName(primary) : "—", MARGIN_L, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  if (primary?.phone) doc.text(`Contact: ${primary.phone}`, MARGIN_L, y + 5);
  if (primary?.email) doc.text(`Email: ${primary.email}`, MARGIN_L, y + 10);
  if (primary?.id) doc.text(`Client ID: ${primary.id}`, PAGE_W - MARGIN_R, y, { align: "right" });
  y += 16;

  // Services table
  y = section(doc, "Service Details", y);
  table(doc, {
    startY: y,
    head: [["S#", "Description", "Passport", "Type", "Amount (PKR)"]],
    body: clients.map((c, i) => [
      String(i + 1),
      `${booking.packageType} Package${booking.travelDate ? ` — ${fmtDate(booking.travelDate)}` : ""}`,
      c.passport || "—",
      "Adult",
      { content: formatCurrency(c.amountDue).replace("PKR", "").trim(), styles: { halign: "right" as const } },
    ]),
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 30 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Pricing summary — right aligned, no heavy borders
  const sumX = PAGE_W - MARGIN_R - 80;
  const labelX = sumX;
  const valueX = PAGE_W - MARGIN_R;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);

  doc.text("Subtotal", labelX, y);
  doc.text(formatCurrency(booking.totalAmount), valueX, y, { align: "right" });
  y += 6;
  doc.text("Tax (0%)", labelX, y);
  doc.text("PKR 0", valueX, y, { align: "right" });
  y += 4;

  // gold divider before grand total
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(sumX, y, PAGE_W - MARGIN_R, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("Grand Total", labelX, y);
  doc.text(formatCurrency(booking.totalAmount), valueX, y, { align: "right" });
  y += 8;

  // Received / Balance summary (compact)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Received", labelX, y);
  doc.setTextColor(...INK);
  doc.text(formatCurrency(booking.amountReceived), valueX, y, { align: "right" });
  y += 5;
  doc.setTextColor(...MUTED);
  doc.text("Balance Due", labelX, y);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(booking.totalAmount - booking.amountReceived), valueX, y, { align: "right" });
  y += 14;

  // Bank details block
  if (y > 230) { doc.addPage(); y = 42; }
  y = section(doc, "Bank Details", y);
  const bank: Array<[string, string]> = [
    ["Bank Name", "Meezan Bank Limited"],
    ["Account Title", "Muhammad Shahid Qadri"],
    ["IBAN", "PK02 MEZN 0001 6801 1259 1008"],
    ["Account Number", "0168 0112591008"],
  ];
  doc.setFontSize(10);
  bank.forEach((b, i) => {
    const yy = y + i * 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(`${b[0]}:`, MARGIN_L, yy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.text(b[1], MARGIN_L + 35, yy);
  });

  footer(doc);
  save(doc, `Avery_Official_Invoice_${invoiceNo}.pdf`);
}

// ============================================================
//  CLIENT STATEMENT
// ============================================================
export function generateClientStatement(client: Client, entries: LedgerEntry[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Client Statement");

  let y = 42;
  y = metaBlock(doc, y, [
    ["Client ID", client.id],
    ["Issue Date", todayLong()],
    ["Name", getClientName(client)],
    ["Head ID", client.headId],
    ["Passport", client.passport || "—"],
    ["Phone", client.phone],
    ["Package", client.packageType],
    ["Status", client.paymentStatus],
  ]) + 4;

  const remaining = client.amountDue - client.amountPaid;
  y = section(doc, "Account Summary", y);
  drawSummary(doc, y, [
    ["Total Due", formatCurrency(client.amountDue)],
    ["Paid", formatCurrency(client.amountPaid)],
    ["Remaining", formatCurrency(remaining)],
  ]);
  y += 18;

  if (entries.length > 0) {
    y = section(doc, "Transaction History", y);
    table(doc, {
      startY: y,
      head: [["Date", "Receipt", "Description", "Amount"]],
      body: entries.map((e) => [
        fmtDate(e.date), e.id, e.note || e.referenceName,
        { content: formatCurrency(e.amount), styles: { halign: "right" as const } },
      ]),
      columnStyles: { 0: { halign: "center", cellWidth: 24 }, 3: { halign: "right" } },
    });
  }

  footer(doc);
  save(doc, `Avery_Statement_${client.id}.pdf`);
}

// ============================================================
//  SUPPLIER LEDGER
// ============================================================
export function generateSupplierLedger(supplier: Supplier, entries: LedgerEntry[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Supplier Ledger");

  let y = 42;
  y = metaBlock(doc, y, [
    ["Supplier ID", supplier.id],
    ["Issue Date", todayLong()],
    ["Company", supplier.companyName],
    ["Contact", supplier.contactPerson],
    ["Service", supplier.serviceType],
    ["Phone", supplier.phone],
    ["Email", supplier.email],
  ]) + 4;

  const remaining = supplier.totalPayable - supplier.totalPaid;
  y = section(doc, "Account Summary", y);
  drawSummary(doc, y, [
    ["Total Payable", formatCurrency(supplier.totalPayable)],
    ["Total Paid", formatCurrency(supplier.totalPaid)],
    ["Remaining", formatCurrency(remaining)],
  ]);
  y += 18;

  if (entries.length > 0) {
    y = section(doc, "Payment History", y);
    table(doc, {
      startY: y,
      head: [["Date", "Receipt", "Reference", "Note", "Amount"]],
      body: entries.map((e) => [
        fmtDate(e.date), e.id, e.headId || "—", e.note,
        { content: formatCurrency(e.amount), styles: { halign: "right" as const } },
      ]),
      columnStyles: { 0: { halign: "center", cellWidth: 24 }, 4: { halign: "right" } },
    });
  }

  footer(doc);
  save(doc, `Avery_Supplier_Ledger_${supplier.id}.pdf`);
}

// ============================================================
//  AGENT REPORT
// ============================================================
export function generateAgentReport(agent: Agent, entries: LedgerEntry[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "Agent Report");

  let y = 42;
  y = metaBlock(doc, y, [
    ["Agent ID", agent.id],
    ["Issue Date", todayLong()],
    ["Name", agent.name],
    ["Phone", agent.phone],
    ["Email", agent.email],
    ["Status", agent.status],
  ]) + 4;

  const payable = (agent.commission || 0) - (agent.paidCommission || 0);
  y = section(doc, "Performance Summary", y);
  drawSummary(doc, y, [
    ["Total Sales", formatCurrency(agent.totalSales)],
    ["Commission", formatCurrency(agent.commission)],
    ["Paid", formatCurrency(agent.paidCommission || 0)],
  ]);
  y += 18;
  drawSummary(doc, y, [
    ["Payable", formatCurrency(payable)],
    ["Total Clients", String(agent.totalClients)],
    ["", ""],
  ]);
  y += 18;

  if (entries.length > 0) {
    y = section(doc, "Commission History", y);
    table(doc, {
      startY: y,
      head: [["Date", "Receipt", "Note", "Amount"]],
      body: entries.map((e) => [
        fmtDate(e.date), e.id, e.note,
        { content: formatCurrency(e.amount), styles: { halign: "right" as const } },
      ]),
      columnStyles: { 0: { halign: "center", cellWidth: 24 }, 3: { halign: "right" } },
    });
  }

  footer(doc);
  save(doc, `Avery_Agent_Report_${agent.id}.pdf`);
}

// ----------------------------------------------------------------
// Clean three-cell summary row (no boxes, just typography + divider)
// ----------------------------------------------------------------
function drawSummary(doc: jsPDF, y: number, cells: Array<[string, string]>) {
  const cellW = CONTENT_W / 3;
  cells.forEach(([label, value], i) => {
    if (!label) return;
    const x = MARGIN_L + i * cellW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(value, x, y + 6);
  });
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, y + 11, PAGE_W - MARGIN_R, y + 11);
  doc.setTextColor(...INK);
}
