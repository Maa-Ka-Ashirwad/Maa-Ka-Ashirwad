"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database";
import { fmtINR } from "@/lib/format";

const emptyForm = { name: "", sku: "", unit: "pcs", purchase_price: "", selling_price: "", gst_rate: "5", current_stock: "", min_stock: "" };

export default function ProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setProducts(data ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      name: form.name,
      sku: form.sku,
      unit: form.unit,
      purchase_price: Number(form.purchase_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      gst_rate: Number(form.gst_rate) || 0,
      current_stock: Number(form.current_stock) || 0,
      min_stock: Number(form.min_stock) || 0,
    });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
  };

  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold font-display">Products</h1>
          <p className="text-sm text-muted mt-1">{products.length} active SKUs</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-accent w-full sm:w-56"
            />
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-accent text-base font-semibold text-sm px-3.5 py-2 rounded-lg hover:brightness-105">
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">GST</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const low = p.current_stock <= p.min_stock;
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtINR(p.selling_price)}</td>
                  <td className="px-4 py-3 text-right text-muted">{p.gst_rate}%</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono px-2 py-0.5 rounded text-xs ${low ? "bg-bad/15 text-bad" : "text-[#B9C7C3]"}`}>
                      {p.current_stock} {p.unit}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">No products yet — add your first one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold font-display">Add Product</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Purchase price" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} type="number" />
                <Field label="Selling price" value={form.selling_price} onChange={(v) => setForm({ ...form, selling_price: v })} type="number" required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="GST %" value={form.gst_rate} onChange={(v) => setForm({ ...form, gst_rate: v })} type="number" />
                <Field label="Stock" value={form.current_stock} onChange={(v) => setForm({ ...form, current_stock: v })} type="number" />
                <Field label="Min stock" value={form.min_stock} onChange={(v) => setForm({ ...form, min_stock: v })} type="number" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full mt-5 bg-accent text-base font-semibold text-sm py-2.5 rounded-lg hover:brightness-105 disabled:opacity-50">
              {saving ? "Saving…" : "Save product"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
