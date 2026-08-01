"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FileBarChart2, Printer, Download, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Sale, SaleItem } from "@/types/database";
import { fmtINR } from "@/lib/format";

type RangeKey = "today" | "week" | "month" | "quarter" | "year" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "quarter", label: "Quarterly" },
  { key: "year", label: "Annual" },
  { key: "custom", label: "Custom" },
];

function getRangeDates(range: RangeKey, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  let from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (range === "week") from.setDate(from.getDate() - 6);
  if (range === "month") from.setDate(from.getDate() - 29);
  if (range === "quarter") from.setDate(from.getDate() - 89);
  if (range === "year") from.setDate(from.getDate() - 364);
  if (range === "custom") {
    return {
      from: customFrom ? new Date(customFrom + "T00:00:00") : from,
      to: customTo ? new Date(customTo + "T23:59:59") : to,
    };
  }
  return { from, to };
}

export default function ReportsPage() {
  const supabase = createClient();
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = getRangeDates(range, customFrom, customTo);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: salesData } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });
    setSales(salesData ?? []);

    const saleIds = (salesData ?? []).map((s) => s.id);
    if (saleIds.length > 0) {
      const { data: itemsData } = await supabase.from("sale_items").select("*").in("sale_id", saleIds);
      setItems(itemsData ?? []);
    } else {
      setItems([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, range, customFrom, customTo]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const summary = useMemo(() => {
    const totalBills = sales.length;
    const totalSales = sales.reduce((s, x) => s + x.grand_total, 0);
    const totalGST = sales.reduce((s, x) => s + x.gst_total, 0);
    const totalDiscount = sales.reduce((s, x) => s + x.discount_amount, 0);
    const cash = sales.filter((s) => s.payment_method === "cash").reduce((s, x) => s + x.grand_total, 0);
    const upi = sales.filter((s) => s.payment_method === "upi").reduce((s, x) => s + x.grand_total, 0);
    const card = sales.filter((s) => s.payment_method === "card").reduce((s, x) => s + x.grand_total, 0);
    const avgBill = totalBills > 0 ? totalSales / totalBills : 0;
    return { totalBills, totalSales, totalGST, totalDiscount, cash, upi, card, avgBill };
  }, [sales]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of items) {
      const existing = map.get(item.product_name) ?? { name: item.product_name, qty: 0, revenue: 0 };
      existing.qty += item.quantity;
      existing.revenue += item.line_total;
      map.set(item.product_name, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [items]);

  const chartData = useMemo(() => {
    const days = Math.max(1, Math.min(31, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1));
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      const total = sales.filter((s) => new Date(s.created_at).toDateString() === d.toDateString()).reduce((sum, s) => sum + s.grand_total, 0);
      return { day: label, sales: total };
    });
  }, [sales, from, to]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet([
      { Metric: "Total Bills", Value: summary.totalBills },
      { Metric: "Total Sales Amount", Value: summary.totalSales },
      { Metric: "Total GST Collected", Value: summary.totalGST },
      { Metric: "Discounts Given", Value: summary.totalDiscount },
      { Metric: "Cash Sales", Value: summary.cash },
      { Metric: "UPI Sales", Value: summary.upi },
      { Metric: "Card Sales", Value: summary.card },
      { Metric: "Average Bill Value", Value: Math.round(summary.avgBill) },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    const salesSheet = XLSX.utils.json_to_sheet(
      sales.map((s) => ({
        Invoice: s.invoice_number,
        Date: new Date(s.created_at).toLocaleString("en-IN"),
        Subtotal: s.subtotal,
        GST: s.gst_total,
        Discount: s.discount_amount,
        Total: s.grand_total,
        Payment: s.payment_method,
      }))
    );
    XLSX.utils.book_append_sheet(wb, salesSheet, "Bills");

    const productsSheet = XLSX.utils.json_to_sheet(
      topProducts.map((p) => ({ Product: p.name, "Qty Sold": p.qty, Revenue: p.revenue }))
    );
    XLSX.utils.book_append_sheet(wb, productsSheet, "Top Products");

    XLSX.writeFile(wb, `Sales-Report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printReport = () => window.print();

  if (loading) return <div className="p-8 text-muted text-sm">Loading report…</div>;

  return (
    <div className="p-5 md:p-8 print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <FileBarChart2 size={22} /> Sales Reports
          </h1>
          <p className="text-sm text-muted mt-1">
            {from.toLocaleDateString("en-IN")} — {to.toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex items-center gap-1.5 bg-surface border border-border text-sm px-3 py-2 rounded-lg hover:border-accent">
            <Printer size={15} /> Print
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 bg-accent text-base font-semibold text-sm px-3 py-2 rounded-lg hover:brightness-105">
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              range === r.key ? "bg-accent text-base border-accent font-semibold" : "bg-surface border-border text-muted hover:border-accent/40"
            }`}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <Calendar size={13} className="text-muted" />
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent" />
            <span className="text-muted text-xs">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total Bills" value={String(summary.totalBills)} />
        <SummaryCard label="Total Sales" value={fmtINR(summary.totalSales)} />
        <SummaryCard label="GST Collected" value={fmtINR(summary.totalGST)} />
        <SummaryCard label="Discounts Given" value={fmtINR(summary.totalDiscount)} />
        <SummaryCard label="Cash Sales" value={fmtINR(summary.cash)} />
        <SummaryCard label="UPI Sales" value={fmtINR(summary.upi)} />
        <SummaryCard label="Card Sales" value={fmtINR(summary.card)} />
        <SummaryCard label="Avg. Bill Value" value={fmtINR(summary.avgBill)} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6 print:hidden">
        <h2 className="font-semibold font-display mb-4">Sales Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#243733" vertical={false} />
            <XAxis dataKey="day" stroke="#8FA39E" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#8FA39E" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip contentStyle={{ background: "#101B1A", border: "1px solid #243733", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtINR(v)} />
            <Bar dataKey="sales" fill="#F2A93B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4">Top Selling Products</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="py-2 font-medium">Product</th>
              <th className="py-2 font-medium text-right">Qty Sold</th>
              <th className="py-2 font-medium text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.name} className="border-b border-border last:border-0">
                <td className="py-2">{p.name}</td>
                <td className="py-2 text-right font-mono">{p.qty}</td>
                <td className="py-2 text-right font-mono">{fmtINR(p.revenue)}</td>
              </tr>
            ))}
            {topProducts.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-muted">No sales in this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1">{label}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}
