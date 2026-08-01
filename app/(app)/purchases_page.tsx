"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Supplier, Purchase } from "@/types/database";
import { fmtINR } from "@/lib/format";

type LineItem = { product_id: string; name: string; quantity: number; purchase_price: number; gst_rate: number };
type PurchaseWithSupplier = Purchase & { supplierName: string };

export default function PurchasesPage() {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [cart, setCart] = useState<LineItem[]>([]);
  const [pickProduct, setPickProduct] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: suppliersData }, { data: productsData }, { data: purchasesData }] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("purchases").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setSuppliers(suppliersData ?? []);
    setProducts(productsData ?? []);
    const supplierMap = new Map((suppliersData ?? []).map((s) => [s.id, s.name]));
    setPurchases((purchasesData ?? []).map((p) => ({ ...p, supplierName: supplierMap.get(p.supplier_id) ?? "Unknown" })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("purchases-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "suppliers" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const addNewSupplier = async () => {
    const name = prompt("New supplier name:");
    if (!name || !name.trim()) return;
    const { data, error } = await supabase.from("suppliers").insert({ name: name.trim() }).select().single();
    if (error) {
      alert(error.message);
      return;
    }
    if (data) setSupplierId(data.id);
  };

  const addLineItem = () => {
    const product = products.find((p) => p.id === pickProduct);
    if (!product) {
      alert("Choose a product first.");
      return;
    }
    const qty = Number(pickQty) || 0;
    if (qty <= 0) {
      alert("Enter a valid quantity.");
      return;
    }
    setCart((c) => [
      ...c,
      { product_id: product.id, name: product.name, quantity: qty, purchase_price: product.purchase_price, gst_rate: product.gst_rate },
    ]);
    setPickProduct("");
    setPickQty("1");
  };

  const updateLine = (idx: number, field: "quantity" | "purchase_price" | "gst_rate", value: number) => {
    setCart((c) => c.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const removeLine = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx));

  const totalAmount = cart.reduce((s, i) => s + i.purchase_price * i.quantity, 0);
  const totalGST = cart.reduce((s, i) => s + (i.purchase_price * i.quantity * i.gst_rate) / 100, 0);

  const savePurchase = async () => {
    if (!supplierId) {
      alert("Choose a supplier.");
      return;
    }
    if (!invoiceNumber.trim()) {
      alert("Enter the supplier's invoice number.");
      return;
    }
    if (cart.length === 0) {
      alert("Add at least one item.");
      return;
    }

    setSaving(true);
    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert({ supplier_id: supplierId, invoice_number: invoiceNumber.trim(), total_amount: totalAmount })
      .select()
      .single();

    if (error || !purchase) {
      setSaving(false);
      alert(error?.message ?? "Could not create purchase.");
      return;
    }

    const { error: itemsError } = await supabase.from("purchase_items").insert(
      cart.map((i) => ({
        purchase_id: purchase.id,
        product_id: i.product_id,
        quantity: i.quantity,
        purchase_price: i.purchase_price,
        gst_rate: i.gst_rate,
        line_total: i.purchase_price * i.quantity,
      }))
    );

    setSaving(false);
    if (itemsError) {
      alert(`Purchase saved but items failed: ${itemsError.message}`);
      return;
    }

    // Stock is auto-incremented server-side by the apply_purchase_item_stock
    // trigger on purchase_items insert — no manual stock update needed here.
    setCart([]);
    setInvoiceNumber("");
    setSupplierId("");
  };

  if (loading) return <div className="p-8 text-muted text-sm">Loading…</div>;

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <Truck size={20} />
        <h1 className="text-2xl font-bold font-display">Purchases</h1>
      </div>
      <p className="text-sm text-muted mb-5">Record stock received from suppliers — this restocks products automatically.</p>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="font-semibold font-display mb-4">New Purchase</h2>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-muted mb-1">Supplier</label>
            <div className="flex gap-2">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex-1 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">— Select —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button type="button" onClick={addNewSupplier} className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs hover:border-accent">
                + New
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Supplier Invoice Number</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="e.g. SUP-INV-2201"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1">Product</label>
            <select
              value={pickProduct}
              onChange={(e) => setPickProduct(e.target.value)}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs text-muted mb-1">Qty</label>
            <input
              type="number"
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button onClick={addLineItem} className="flex items-center gap-1 bg-accent text-base font-semibold text-sm px-3.5 py-2 rounded-lg hover:brightness-105 shrink-0">
            <Plus size={15} /> Add
          </button>
        </div>

        {cart.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border bg-surface-elevated">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Purchase Price</th>
                  <th className="px-3 py-2 font-medium text-right">GST %</th>
                  <th className="px-3 py-2 font-medium text-right">Line Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" value={item.quantity} onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))} className="w-16 bg-base border border-border rounded px-1.5 py-1 text-right text-xs" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" value={item.purchase_price} onChange={(e) => updateLine(idx, "purchase_price", Number(e.target.value))} className="w-20 bg-base border border-border rounded px-1.5 py-1 text-right text-xs" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" value={item.gst_rate} onChange={(e) => updateLine(idx, "gst_rate", Number(e.target.value))} className="w-14 bg-base border border-border rounded px-1.5 py-1 text-right text-xs" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtINR(item.purchase_price * item.quantity)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeLine(idx)} className="text-bad hover:bg-bad/10 rounded p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cart.length > 0 && (
          <div className="flex justify-end gap-6 text-sm mb-4">
            <div><span className="text-muted">GST: </span><span className="font-mono">{fmtINR(totalGST)}</span></div>
            <div><span className="text-muted">Total: </span><span className="font-mono font-bold">{fmtINR(totalAmount)}</span></div>
          </div>
        )}

        <button
          onClick={savePurchase}
          disabled={saving || cart.length === 0}
          className="w-full bg-accent text-base font-semibold text-sm py-2.5 rounded-lg hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Purchase & Restock"}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
                <td className="px-4 py-3 font-mono text-xs">{p.invoice_number}</td>
                <td className="px-4 py-3">{p.supplierName}</td>
                <td className="px-4 py-3 text-muted text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 text-right font-mono">{fmtINR(p.total_amount)}</td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No purchases recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">
        Adding a new supplier here only asks for a name — for full supplier details (contact, GSTIN, address), the dedicated Suppliers page is still a separate feature not yet built.
      </p>
    </div>
  );
}
