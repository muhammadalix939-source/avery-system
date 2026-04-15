import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./data";
import type { Client, Agent, Supplier, Booking } from "./data";
import type { LedgerEntry } from "./store";

const COMPANY = "Avery International Travel & Tours";
const COMPANY_PHONE = "0330-2793701";
const COMPANY_EMAIL = "info@averytravel.com";

function addHeader(doc: jsPDF, title: string) {
  // Gold header bar
  doc.setFillColor(180, 150, 50);
  doc.rect(0, 0, 210, 32, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY, 14, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${COMPANY_PHONE} | ${COMPANY_EMAIL}`, 14, 22);
  doc.setFontSize(10);
  doc.text(title, 14, 29);

  // Date
  const now = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
  doc.setFontSize(7);
  doc.text(`Generated: ${now}`, 196, 29, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`${COMPANY} — Confidential`, 14, 287);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: "right" });
  }
}

export function generateClientStatement(client: Client, entries: LedgerEntry[]) {
  const doc = new jsPDF();
  addHeader(doc, "CLIENT STATEMENT");

  let y = 40;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`${client.name}`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Client ID: ${client.id}  |  Head ID: ${client.headId}  |  Passport: ${client.passport}`, 14, y);
  y += 5;
  doc.text(`Phone: ${client.phone}  |  Package: ${client.packageType}  |  VIP: ${client.isVip ? "Yes" : "No"}`, 14, y);
  y += 10;

  // Summary box
  doc.setFillColor(245, 245, 240);
  doc.roundedRect(14, y, 182, 20, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Total Due", 24, y + 8);
  doc.text("Paid", 85, y + 8);
  doc.text("Remaining", 145, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(formatCurrency(client.amountDue), 24, y + 15);
  doc.setTextColor(0, 130, 0);
  doc.text(formatCurrency(client.amountPaid), 85, y + 15);
  doc.setTextColor(200, 0, 0);
  doc.text(formatCurrency(client.amountDue - client.amountPaid), 145, y + 15);
  y += 28;

  // Transactions
  if (entries.length > 0) {
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Transaction History", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Description", "Debit", "Credit", "Balance"]],
      body: entries.map((e, i) => {
        const isCredit = e.type === "client_receive";
        return [e.date, e.note || e.type, isCredit ? "" : formatCurrency(e.amount), isCredit ? formatCurrency(e.amount) : "", ""];
      }),
      theme: "grid",
      headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`Statement_${client.id}_${client.name.replace(/\s/g, "_")}.pdf`);
}

export function generateSupplierLedger(supplier: Supplier, entries: LedgerEntry[]) {
  const doc = new jsPDF();
  addHeader(doc, "SUPPLIER LEDGER");

  let y = 40;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(supplier.companyName, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Supplier ID: ${supplier.id}  |  Contact: ${supplier.contactPerson}  |  Service: ${supplier.serviceType}`, 14, y);
  y += 5;
  doc.text(`Phone: ${supplier.phone}  |  Email: ${supplier.email}`, 14, y);
  y += 10;

  const remaining = supplier.totalPayable - supplier.totalPaid;
  doc.setFillColor(245, 245, 240);
  doc.roundedRect(14, y, 182, 20, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Total Payable", 24, y + 8);
  doc.text("Total Paid", 85, y + 8);
  doc.text("Remaining", 145, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(formatCurrency(supplier.totalPayable), 24, y + 15);
  doc.setTextColor(0, 130, 0);
  doc.text(formatCurrency(supplier.totalPaid), 85, y + 15);
  doc.setTextColor(200, 0, 0);
  doc.text(formatCurrency(remaining), 145, y + 15);
  y += 28;

  if (entries.length > 0) {
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Payment History", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Description", "Amount Paid", "Note"]],
      body: entries.map((e) => [e.date, e.referenceName, formatCurrency(e.amount), e.note]),
      theme: "grid",
      headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`Ledger_${supplier.id}_${supplier.companyName.replace(/\s/g, "_")}.pdf`);
}

export function generateAgentReport(agent: Agent, entries: LedgerEntry[]) {
  const doc = new jsPDF();
  addHeader(doc, "AGENT PERFORMANCE REPORT");

  let y = 40;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(agent.name, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Agent ID: ${agent.id}  |  Phone: ${agent.phone}  |  Email: ${agent.email}`, 14, y);
  y += 10;

  doc.setFillColor(245, 245, 240);
  doc.roundedRect(14, y, 182, 20, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Total Sales", 24, y + 8);
  doc.text("Total Clients", 85, y + 8);
  doc.text("Commission", 145, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text(formatCurrency(agent.totalSales), 24, y + 15);
  doc.text(String(agent.totalClients), 85, y + 15);
  doc.setTextColor(0, 130, 0);
  doc.text(formatCurrency(agent.commission), 145, y + 15);
  y += 28;

  if (entries.length > 0) {
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Commission History", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Description", "Amount", "Note"]],
      body: entries.map((e) => [e.date, e.referenceName, formatCurrency(e.amount), e.note]),
      theme: "grid",
      headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`Report_${agent.id}_${agent.name.replace(/\s/g, "_")}.pdf`);
}

export function generateInvoice(booking: Booking, clients: Client[], agent?: Agent, supplier?: Supplier) {
  const doc = new jsPDF();
  addHeader(doc, "INVOICE");

  let y = 40;
  const invoiceId = `INV-${booking.headId.replace("AV-HD-", "")}`;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`Invoice: ${invoiceId}`, 14, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "long" })}`, 196, y, { align: "right" });
  y += 10;

  doc.setTextColor(60, 60, 60);
  doc.text(`Head ID: ${booking.headId}`, 14, y);
  doc.text(`Package: ${booking.packageType}`, 85, y);
  doc.text(`Travel Date: ${booking.travelDate}`, 145, y);
  y += 5;
  if (agent) doc.text(`Agent: ${agent.name} (${agent.id})`, 14, y);
  if (supplier) doc.text(`Supplier: ${supplier.companyName} (${supplier.id})`, 105, y);
  y += 10;

  // Client breakdown
  autoTable(doc, {
    startY: y,
    head: [["#", "Client ID", "Name", "Passport", "Amount Due", "Amount Paid", "Status"]],
    body: clients.map((c, i) => [
      i + 1, c.id, c.name, c.passport, formatCurrency(c.amountDue), formatCurrency(c.amountPaid), c.paymentStatus,
    ]),
    theme: "grid",
    headStyles: { fillColor: [180, 150, 50], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Summary
  doc.setFillColor(245, 245, 240);
  doc.roundedRect(100, y, 96, 30, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Total Amount:", 105, y + 8);
  doc.text(formatCurrency(booking.totalAmount), 190, y + 8, { align: "right" });
  doc.text("Amount Received:", 105, y + 16);
  doc.setTextColor(0, 130, 0);
  doc.text(formatCurrency(booking.amountReceived), 190, y + 16, { align: "right" });
  doc.setTextColor(200, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Balance Due:", 105, y + 24);
  doc.text(formatCurrency(booking.totalAmount - booking.amountReceived), 190, y + 24, { align: "right" });

  addFooter(doc);
  doc.save(`Invoice_${invoiceId}.pdf`);
}

export function generateHotelVoucher(booking: Booking, client: Client, hotelName: string, checkIn: string, checkOut: string, roomType: string) {
  const doc = new jsPDF();
  addHeader(doc, "HOTEL VOUCHER");

  let y = 40;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Hotel Accommodation Voucher", 14, y);
  y += 12;

  const rows = [
    ["Booking ID (Head ID)", booking.headId],
    ["Guest Name", client.name],
    ["Passport", client.passport],
    ["Hotel Name", hotelName],
    ["Check-in Date", checkIn],
    ["Check-out Date", checkOut],
    ["Room Type", roomType],
    ["Package", booking.packageType],
    ["Travel Date", booking.travelDate],
  ];

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, textColor: [80, 80, 80] },
      1: { cellWidth: 120 },
    },
    bodyStyles: { fontSize: 10, cellPadding: 4 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("This voucher confirms the hotel reservation. Please present this voucher at check-in.", 14, y);
  y += 5;
  doc.text("For any changes, contact Avery International Travel & Tours.", 14, y);

  addFooter(doc);
  doc.save(`Voucher_${booking.headId}_${client.name.replace(/\s/g, "_")}.pdf`);
}
