"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, TrendingUp, Package, FileBarChart2, Clock, CheckCircle2, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { Product, Sale, SaleItem } from "@/types/database";
import { KPICard } from "@/components/dashboard/KPICard";
import { fmtINR } from "@/lib/format";

export default function DashboardPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: productsData }, { data: salesData }] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true),
      supabase.from("sales").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }),
    ]);

    setProducts(productsData ?? []);
    setSales(salesData ?? []);

    // Line items are needed to compute profit (selling price vs. purchase cost
    // per item actually sold) — fetched separately since they're keyed by sale_id.
    const saleIds = (salesData ?? []).map((s) => s.id);
    if (saleIds.length > 0) {
      const { data: itemsData } = await supabase.from("sale_items").select("*").in("sale_id", saleIds);
      setSaleItems(itemsData ?? []);
    } else {
      setSaleItems([]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();

    // Real-time: any insert/update to products, sales, or sale_items refreshes
    // the dashboard instantly for every logged-in user — including profit.
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_items" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  if (loading) {
    return <div className="p-8 text-muted text-sm">Loading live store data…</div>;
  }

  const today = new Date().toDateString();
  const todaySales = sales.filter((s) => new Date(s.created_at).toDateString() === today);
  const todayRevenue = todaySales.reduce((s, x) => s + x.grand_total, 0);
  const lowStock = products.filter((p) => p.current_stock <= p.min_stock);
  const stockValue = products.reduce((s, p) => s + p.selling_price * p.current_stock, 0);

  // Profit = (what each item sold for − what it cost us) × quantity, summed
  // across today's sales. Cost comes from the product's current purchase_price
  // (not a historical snapshot, since sale_items doesn't store cost at time of sale).
  const costById = new Map(products.map((p) => [p.id, p.purchase_price]));
  const todaySaleIds = new Set(todaySales.map((s) => s.id));
  const todayProfit = saleItems
    .filter((si) => todaySaleIds.has(si.sale_id))
    .reduce((sum, si) => {
      const cost = costById.get(si.product_id) ?? 0;
      return sum + (si.unit_price - cost) * si.quantity;
    }, 0);

  // group last 7 days for the revenue chart
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });
    const dayTotal = sales
      .filter((s) => new Date(s.created_at).toDateString() === d.toDateString())
      .reduce((sum, s) => sum + s.grand_total, 0);
    return { day: dayLabel, revenue: dayTotal };
  });

  return (
    <div className="p-5 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Live store overview · updates automatically</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Today's Sales" value={fmtINR(todayRevenue)} icon={TrendingUp} accent="#F2A93B" />
        <KPICard label="Today's Profit" value={fmtINR(todayProfit)} icon={Wallet} accent="#7FBF9E" />
        <KPICard label="Today's Bills" value={String(todaySales.length)} icon={FileBarChart2} accent="#C1443A" />
        <KPICard label="Stock Value" value={fmtINR(stockValue)} icon={Package} accent="#6FA8DC" />
        <KPICard label="Low Stock Items" value={String(lowStock.length)} icon={AlertTriangle} accent="#E08B7D" />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold font-display">Weekly Revenue</h2>
          <span className="text-xs text-muted">Last 7 days</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F2A93B" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#F2A93B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#243733" vertical={false} />
            <XAxis dataKey="day" stroke="#8FA39E" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#8FA39E" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip
              contentStyle={{ background: "#101B1A", border: "1px solid #243733", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => fmtINR(v)}
            />
            <Area type="monotone" dataKey="revenue" stroke="#F2A93B" strokeWidth={2} fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-semibold font-display mb-4 flex items-center gap-2">
            <Clock size={16} /> Recent Transactions
          </h2>
          <div className="space-y-1">
            {sales.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-mono">{tx.invoice_number}</div>
                  <div className="text-xs text-muted">{new Date(tx.created_at).toLocaleTimeString("en-IN")}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">{fmtINR(tx.grand_total)}</div>
                  <div className="text-xs text-muted capitalize">{tx.payment_method}</div>
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="text-sm text-muted">No sales yet — ring up your first bill in POS.</p>}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-bad" />
            <h2 className="font-semibold font-display">Low Stock Alerts</h2>
          </div>
          <div className="space-y-1">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="text-sm">{p.name}</div>
                <div className="text-sm font-mono text-bad">{p.current_stock} {p.unit}</div>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-good">
                <CheckCircle2 size={14} /> All stock levels healthy
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
