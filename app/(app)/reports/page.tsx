"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FileBarChart2, Printer, Download, Calendar, Package, Percent, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { Sale, SaleItem, Product, Category } from "@/types/database";
import { fmtINR } from "@/lib/format";

type ReportTab = "sales" | "stock" | "gst" | "pnl";
type RangeKey = "today" | "week" | "month" | "quarter" | "year" | "custom";
type StockFilter = "all" | "low" | "out" | "over";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "quarter", label: "Quarterly" },
  { key: "year", label: "Annual" },
  { key: "custom", label: "Custom" },
];

const STOCK_FILTERS: { key: StockFilter; label: string }[] = [
  { key: "all", label: "Current Stock" },
  { key: "low", label: "Low Stock" },
  { key: "out", label: "Out of Stock" },
  { key: "over", label: "Overstock" },
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
  const [tab, setTab] = useState<ReportTab>("sales");

  // ---- Shared date-range state (used by Sales, GST, and P&L tabs) ----
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  const { from, to } = getRangeDates(range, customFrom, customTo);

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
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
    setLoadingSales(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, range, customFrom, customTo]);

  // ---- Products (used by Stock tab, and for cost basis in P&L tab) ----
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [loadingStock, setLoadingStock] = useState(true);

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    const [{ data: productsData }, { data: categoriesData }] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("categories").select("*"),
    ]);
    setProducts(productsData ?? []);
    setCategories(categoriesData ?? []);
    setLoadingStock(false);
  }, [supabase]);

  useEffect(() => {
    loadSales();
    loadStock(); // always loaded — P&L needs product cost basis regardless of active tab
  }, [loadSales, loadStock]);

  useEffect(() => {
    const channel = supabase
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadSales)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadStock)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadSales, loadStock]);

  const summary = useMemo(() => {
    const totalBills = sales.length;
    const totalSales = sales.reduce((s, x) => s + x.grand_total, 0);
    const totalGST = sales.reduce((s, x) => s + x.gst_total, 0);
    const totalDiscount = sales.reduce((s, x) => s + x.discount_amount, 0);
    const cash = sales.filter((s) => s.payment_method === "cash").reduce((s, x) => s + x.grand_total, 0);
    const upi = sales.filter((s) => s.payment_method === "upi").reduce((s, x) => s + x.grand_total, 0);
    const card = sales.filter((s) => s.payment_method === "card").reduce((s, x) => s + x.grand_total, 0);
    const avgBill = totalBills > 0 ? totalSales / totalBills : 0;
    const taxableSales = sales.reduce((s, x) => s + x.subtotal, 0);
    return { totalBills, totalSales, totalGST, totalDiscount, cash, upi, card, avgBill, taxableSales };
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

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  const filteredStock = useMemo(() => {
    return products.filter((p) => {
      if (stockFilter === "low") return p.current_stock > 0 && p.current_stock <= p.min_stock;
      if (stockFilter === "out") return p.current_stock <= 0;
      if (stockFilter === "over") return p.min_stock > 0 && p.current_stock > p.min_stock * 3;
      return true;
    });
  }, [products, stockFilter]);

  const stockValuation = useMemo(() => {
    const totalPurchaseValue = products.reduce((s, p) => s + p.purchase_price * p.current_stock, 0);
    const totalSellingValue = products.reduce((s, p) => s + p.selling_price * p.current_stock, 0);
    return { totalPurchaseValue, totalSellingValue };
  }, [products]);

  // ---- GST breakdown ----
  // CGST/SGST split assumes all sales are intra-state (the schema doesn't record
  // buyer location or transaction type), so IGST can't be calculated separately.
  const gst = useMemo(() => {
    const cgst = summary.totalGST / 2;
    const sgst = summary.totalGST / 2;
    return { cgst, sgst };
  }, [summary.totalGST]);

  // ---- Profit & Loss ----
  // Total Purchase Cost here = cost of goods actually SOLD (COGS), using each
  // product's current purchase_price against every unit sold in the sale_items
  // for this range. This is not the same as total money spent on purchase
  // orders — that would need the Purchases module, which isn't built yet.
  const pnl = useMemo(() => {
    const costById = new Map(products.map((p) => [p.id, p.purchase_price]));
    const cogs = items.reduce((sum, i) => sum + (costById.get(i.product_id) ?? 0) * i.quantity, 0);
    const totalSalesRevenue = summary.taxableSales;
    const grossProfit = totalSalesRevenue - cogs;
    const netProfit = grossProfit - summary.totalDiscount;
    return { cogs, totalSalesRevenue, grossProfit, netProfit };
  }, [items, products, summary.taxableSales, summary.totalDiscount]);

  const exportSalesExcel = () => {
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
    const productsSheet = XLSX.utils.json_to_sheet(topProducts.map((p) => ({ Product: p.name, "Qty Sold": p.qty, Revenue: p.revenue })));
    XLSX.utils.book_append_sheet(wb, productsSheet, "Top Products");
    XLSX.writeFile(wb, `Sales-Report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportStockExcel = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      filteredStock.map((p) => ({
        Product: p.name,
        Category: categoryName(p.category_id),
        "Stock Qty": p.current_stock,
        Unit: p.unit,
        "Purchase Price": p.purchase_price,
        "Selling Price": p.selling_price,
        "Inventory Value (at cost)": p.purchase_price * p.current_stock,
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheet, "Stock");
    XLSX.writeFile(wb, `Stock-Report-${stockFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportGSTExcel = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      { Metric: "Taxable Sales", Value: summary.taxableSales },
      { Metric: "Total GST Collected", Value: summary.totalGST },
      { Metric: "CGST (assumed intra-state)", Value: gst.cgst },
      { Metric: "SGST (assumed intra-state)", Value: gst.sgst },
      { Metric: "IGST", Value: "Not tracked — buyer location not recorded" },
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "GST Summary");
    XLSX.writeFile(wb, `GST-Report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPnLExcel = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      { Metric: "Total Sales (excl. GST)", Value: pnl.totalSalesRevenue },
      { Metric: "Total Purchase Cost (COGS)", Value: pnl.cogs },
      { Metric: "Gross Profit", Value: pnl.grossProfit },
      { Metric: "Discounts Given", Value: summary.totalDiscount },
      { Metric: "Net Profit", Value: pnl.netProfit },
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Profit & Loss");
    XLSX.writeFile(wb, `PnL-Report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const printReport = () => window.print();

  const RangePicker = (
    <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${range === r.key ? "bg-accent text-base border-accent font-semibold" : "bg-surface border-border text-muted hover:border-accent/40"}`}
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
  );

  return (
    <div className="p-5 md:p-8 print:p-0">
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <TabButton active={tab === "sales"} onClick={() => setTab("sales")} icon={FileBarChart2} label="Sales" />
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")} icon={Package} label="Stock" />
        <TabButton active={tab === "gst"} onClick={() => setTab("gst")} icon={Percent} label="GST" />
        <TabButton active={tab === "pnl"} onClick={() => setTab("pnl")} icon={TrendingUp} label="Profit & Loss" />
      </div>

      {tab === "sales" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 print:hidden">
            <p className="text-sm text-muted">{from.toLocaleDateString("en-IN")} — {to.toLocaleDateString("en-IN")}</p>
            <ExportButtons onPrint={printReport} onExport={exportSalesExcel} />
          </div>
          {RangePicker}
          {loadingSales ? (
            <div className="text-muted text-sm">Loading…</div>
          ) : (
            <>
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
                    {topProducts.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted">No sales in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === "stock" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 print:hidden">
            <p className="text-sm text-muted">{filteredStock.length} products</p>
            <ExportButtons onPrint={printReport} onExport={exportStockExcel} />
          </div>
          <div className="flex flex-wrap gap-2 mb-5 print:hidden">
            {STOCK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStockFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${stockFilter === f.key ? "bg-accent text-base border-accent font-semibold" : "bg-surface border-border text-muted hover:border-accent/40"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {loadingStock ? (
            <div className="text-muted text-sm">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                <SummaryCard label="Total Products" value={String(products.length)} />
                <SummaryCard label="Stock Value (at cost)" value={fmtINR(stockValuation.totalPurchaseValue)} />
                <SummaryCard label="Stock Value (at selling)" value={fmtINR(stockValuation.totalSellingValue)} />
              </div>
              <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium text-right">Stock Qty</th>
                      <th className="px-4 py-3 font-medium text-right">Purchase Price</th>
                      <th className="px-4 py-3 font-medium text-right">Selling Price</th>
                      <th className="px-4 py-3 font-medium text-right">Inventory Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-muted text-xs">{categoryName(p.category_id)}</td>
                        <td className="px-4 py-3 text-right font-mono">{p.current_stock} {p.unit}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtINR(p.purchase_price)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtINR(p.selling_price)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtINR(p.purchase_price * p.current_stock)}</td>
                      </tr>
                    ))}
                    {filteredStock.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No products match this filter.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted mt-3">"Overstock" is estimated as more than 3× a product's minimum stock level.</p>
            </>
          )}
        </>
      )}

      {tab === "gst" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 print:hidden">
            <p className="text-sm text-muted">{from.toLocaleDateString("en-IN")} — {to.toLocaleDateString("en-IN")}</p>
            <ExportButtons onPrint={printReport} onExport={exportGSTExcel} />
          </div>
          {RangePicker}
          {loadingSales ? (
            <div className="text-muted text-sm">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <SummaryCard label="Taxable Sales" value={fmtINR(summary.taxableSales)} />
              <SummaryCard label="Total GST Collected" value={fmtINR(summary.totalGST)} />
              <SummaryCard label="CGST" value={fmtINR(gst.cgst)} />
              <SummaryCard label="SGST" value={fmtINR(gst.sgst)} />
              <SummaryCard label="IGST" value="Not tracked" />
            </div>
          )}
          <p className="text-xs text-muted mt-4">
            CGST/SGST assumes all sales are intra-state — the app doesn't currently record buyer location or transaction type, so IGST can't be split out separately. "GST Paid" (on purchases) isn't shown since the Purchases module isn't built yet.
          </p>
        </>
      )}

      {tab === "pnl" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 print:hidden">
            <p className="text-sm text-muted">{from.toLocaleDateString("en-IN")} — {to.toLocaleDateString("en-IN")}</p>
            <ExportButtons onPrint={printReport} onExport={exportPnLExcel} />
          </div>
          {RangePicker}
          {loadingSales || loadingStock ? (
            <div className="text-muted text-sm">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <SummaryCard label="Total Sales (excl. GST)" value={fmtINR(pnl.totalSalesRevenue)} />
              <SummaryCard label="Total Purchase Cost (COGS)" value={fmtINR(pnl.cogs)} />
              <SummaryCard label="Gross Profit" value={fmtINR(pnl.grossProfit)} />
              <SummaryCard label="Discounts Given" value={fmtINR(summary.totalDiscount)} />
              <SummaryCard label="Net Profit" value={fmtINR(pnl.netProfit)} />
            </div>
          )}
          <p className="text-xs text-muted mt-4">
            "Total Purchase Cost" here is the cost of goods actually sold (COGS) — quantity sold × each product's current purchase price. This differs from total money spent on purchase orders, which would need the Purchases module (not built yet).
          </p>
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition-colors ${active ? "bg-accent text-base border-accent font-semibold" : "bg-surface border-border text-muted hover:border-accent/40"}`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function ExportButtons({ onPrint, onExport }: { onPrint: () => void; onExport: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={onPrint} className="flex items-center gap-1.5 bg-surface border border-border text-sm px-3 py-2 rounded-lg hover:border-accent">
        <Printer size={15} /> Print
      </button>
      <button onClick={onExport} className="flex items-center gap-1.5 bg-accent text-base font-semibold text-sm px-3 py-2 rounded-lg hover:brightness-105">
        <Download size={15} /> Export Excel
      </button>
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
