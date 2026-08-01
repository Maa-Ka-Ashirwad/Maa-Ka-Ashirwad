import { jsPDF } from "jspdf";
import { fmtINR } from "./format";
import type { BillItem } from "@/components/pos/Receipt";

export type InvoiceData = {
  invoice_number: string;
  createdAt: string; // ISO timestamp
  items: BillItem[];
  subtotal: number;
  gstTotal: number;
  discountAmt: number;
  discountPct: number;
  grandTotal: number;
  payment: string;
  customerName?: string;
};

export type StoreInfo = {
  name: string;
  address?: string;
  gstin?: string;
};

// Generates a professional A4 invoice PDF and triggers a browser download.
// For thermal receipts, use window.print() on the on-screen Receipt component
// instead — this function is specifically the "Download PDF" (A4) path.
export function downloadInvoicePDF(bill: InvoiceData, store: StoreInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginX = 18;
  let y = 20;

  // Header — store identity
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(store.name, marginX, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (store.address) {
    doc.text(store.address, marginX, y);
    y += 5;
  }
  if (store.gstin) {
    doc.text(`GSTIN: ${store.gstin}`, marginX, y);
    y += 5;
  }

  // Invoice meta — right aligned
  const metaX = pageWidth - marginX;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", metaX, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Invoice #: ${bill.invoice_number}`, metaX, 27, { align: "right" });
  const dt = new Date(bill.createdAt);
  doc.text(`Date: ${dt.toLocaleDateString("en-IN")}  ${dt.toLocaleTimeString("en-IN")}`, metaX, 32, { align: "right" });

  y += 4;
  if (bill.customerName) {
    doc.text(`Customer: ${bill.customerName}`, marginX, y);
    y += 6;
  }

  y += 2;
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // Table header
  const col = { name: marginX, qty: 110, price: 135, gst: 160, total: pageWidth - marginX };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Product", col.name, y);
  doc.text("Qty", col.qty, y);
  doc.text("Unit Price", col.price, y);
  doc.text("GST%", col.gst, y);
  doc.text("Total", col.total, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.15);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  bill.items.forEach((item) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    doc.text(item.name, col.name, y, { maxWidth: 85 });
    doc.text(String(item.qty), col.qty, y);
    doc.text(fmtINR(item.price), col.price, y);
    doc.text(String(item.gstRate ?? ""), col.gst, y);
    doc.text(fmtINR(item.price * item.qty), col.total, y, { align: "right" });
    y += 6;
  });

  y += 2;
  doc.setLineWidth(0.15);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // Totals block — right aligned
  const totalsX = pageWidth - marginX;
  doc.setFontSize(10);
  doc.text(`Subtotal: ${fmtINR(bill.subtotal)}`, totalsX, y, { align: "right" });
  y += 5.5;
  doc.text(`GST: ${fmtINR(bill.gstTotal)}`, totalsX, y, { align: "right" });
  y += 5.5;
  if (bill.discountAmt > 0) {
    doc.text(`Discount (${bill.discountPct}%): -${fmtINR(bill.discountAmt)}`, totalsX, y, { align: "right" });
    y += 5.5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: ${fmtINR(bill.grandTotal)}`, totalsX, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Payment Mode: ${bill.payment.toUpperCase()}`, marginX, y);
  y += 15;

  // Footer
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text("Thank You! Visit Again", pageWidth / 2, y, { align: "center" });

  doc.save(`${bill.invoice_number}.pdf`);
}
