"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Pencil, Percent, Trash2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database";
import { fmtINR } from "@/lib/format";
import { daysRemaining, expiryStatus, expiryColorClasses, expiryLabel, type ExpiryStatus } from "@/lib/expiry";

type FilterKey = "7" | "20" | "30" | "expired" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "7", label: "Expiring in 7 Days" },
  { key: "20", label: "Expiring in 20 Days" },
  { key: "30", label: "Expiring in 30 Days" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

export default function ExpiryAlertsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<FilterKey>("30");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .order("expiry_date", { ascending: true });
    setProducts(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("expiry-alerts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const filtered = products.filter((p) => {
    const days = daysRemaining(p.expiry_date);
    if (days === null) return false;
    if (filter === "all") return true;
    if (filter === "expired") return days < 0;
    if (filter === "7") return days >= 0 && days <= 7;
    if (filter === "20") return days >= 0 && days <= 20;
    if (filter === "30") return days >= 0 && days <= 30;
    return true;
  });

  const applyDiscount = async (p: Product) => {
    const pctStr = prompt(`Apply what % discount to "${p.name}"? (reduces selling price)`, "10");
    if (!pctStr) return;
    const pct = Number(pctStr);
    if (!pct || pct <= 0 || pct >= 100) {
      alert("Enter a valid percentage between 1 and 99.");
      return;
    }
    const newPrice = Math.round(p.selling_price * (1 - pct / 100) * 100) / 100;
    const { error } = await supabase.from("products").update({ selling_price: newPrice }).eq("id", p.id);
    if (error) alert(error.message);
  };

  const removeProduct = async (p: Product) => {
    if (!confirm(`Remove "${p.name}" from active inventory? This deactivates it (does not delete sale history).`)) return;
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", p.id);
    if (error) alert(error.message);
  };

  const returnToSupplier = async (p: Product) => {
    if (!p.supplier_id) {
      alert("This product has no supplier on file — set one in Products before returning stock.");
      return;
    }
    if (!confirm(`Log a return of ${p.current_stock} ${p.unit} of "${p.name}" to supplier and zero out stock?`)) return;
    const { error: moveError } = await supabase.from("stock_movements").insert({
      product_id: p.id,
      type: "purchase_return",
      quantity_change: -p.current_stock,
      note: "Returned to supplier — near/at expiry",
    } as never);
    if (moveError) {
      alert(moveError.message);
      return;
    }
    const { error } = await supabase.from("products").update({ current_stock: 0 }).eq("id", p.id);
    if (error) alert(error.message);
  };

  if (loading) return <div className="p-8 text-muted text-sm">Loading expiry data…</div>;

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={20} className="text-bad" />
        <h1 className="text-2xl font-bold font-display">Expiry Alerts</h1>
      </div>
      <p className="text-sm text-muted mb-5">{filtered.length} products match this filter</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key ? "bg-accent text-base border-accent font-semibold" : "bg-surface border-border text-muted hover:border-accent/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium text-right">Qty Available</th>
              <th className="px-4 py-3 font-medium">Expiry Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const days = daysRemaining(p.expiry_date);
              const status: ExpiryStatus = expiryStatus(p.expiry_date);
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{p.batch_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs">{p.brand ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.current_stock} {p.unit}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.expiry_date ? new Date(p.expiry_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${expiryColorClasses(status)}`}>
                      {expiryLabel(status, days)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button title="Apply Discount" onClick={() => applyDiscount(p)} className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:text-accent">
                        <Percent size={13} />
                      </button>
                      <button title="Return to Supplier" onClick={() => returnToSupplier(p)} className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:text-accent">
                        <RotateCcw size={13} />
                      </button>
                      <button title="Remove Product" onClick={() => removeProduct(p)} className="w-7 h-7 flex items-center justify-center rounded bg-surface-elevated hover:text-bad">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">No products match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">
        Note: "Edit Product" isn't available yet — product editing is a separate feature not built in this app yet. Use Supabase's Table Editor for now if you need to correct an expiry date.
      </p>
    </div>
  );
}
