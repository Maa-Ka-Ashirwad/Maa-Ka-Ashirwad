"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Minus, Trash2, ShoppingCart, Percent, Banknote, Smartphone, CreditCard, CheckCircle2, AlertTriangle, Printer, Download, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database";
import { fmtINR } from "@/lib/format";
import { Receipt, type BillItem } from "@/components/pos/Receipt";
import { daysRemaining, expiryStatus } from "@/lib/expiry";
import { downloadInvoicePDF } from "@/lib/invoice";

type CartItem = Product & { qty: number };
type LastBill = {
  invoice_number: string;
  items: BillItem[];
  subtotal: number;
  gstTotal: number;
  discountAmt: number;
  discountPct: number;
  grandTotal: number;
  payment: string;
  customerName?: string;
  createdAt: string;
};

export default function POSPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [payment, setPayment] = useState<"cash" | "upi" | "card">("upi");
  const [customerName, setCustomerName] = useState("");
  const [lastBill, setLastBill] = useState<LastBill | null>(null);
  const [charging, setCharging] = useState(false);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").eq("is_active", true).order("name");
    setProducts(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadProducts();
    const channel = supabase
      .channel("pos-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadProducts)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadProducts]);

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase()) || p.barcode?.includes(query)
  );

  const addToCart = (p: Product) => {
    const status = expiryStatus(p.expiry_date);
    const days = daysRemaining(p.expiry_date);

    if (status === "expired") {
      alert("This product has expired and cannot be sold.");
      return;
    }
    if (status === "warning-20") {
      const proceed = confirm(`Warning: This product will expire in ${days} days. Continue adding it to the bill?`);
      if (!proceed) return;
    }

    setCart((c) => {
      const existing = c.find((i) => i.id === p.id);
      if (existing) return c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { ...p, qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  };

  const subtotal = cart.reduce((s, i) => s + i.selling_price * i.qty, 0);
  const gstTotal = cart.reduce((s, i) => s + (i.selling_price * i.qty * i.gst_rate) / 100, 0);
  const discountAmt = (subtotal * discountPct) / 100;
  const grandTotal = subtotal + gstTotal - discountAmt;

  const chargeBill = async () => {
    if (cart.length === 0) return;

    const expiredInCart = cart.find((i) => expiryStatus(i.expiry_date) === "expired");
    if (expiredInCart) {
      alert(`"${expiredInCart.name}" has expired and cannot be sold. Please remove it from the cart.`);
      return;
    }

    setCharging(true);

    const payload = {
      subtotal,
      gst_total: gstTotal,
      discount_pct: discountPct,
      discount_amount: discountAmt,
      grand_total: grandTotal,
      payment_method: payment,
      items: cart.map((i) => ({
        product_id: i.id,
        product_name: i.name,
        quantity: i.qty,
        unit_price: i.selling_price,
        gst_rate: i.gst_rate,
        line_total: i.selling_price * i.qty,
      })),
    };

    const { data, error } = await supabase.rpc("create_sale", { payload } as never);
    setCharging(false);

    if (error) {
      alert(`Could not complete sale: ${error.message}`);
      return;
    }

    setLastBill({
      invoice_number: (data as any).invoice_number,
      items: cart.map((i) => ({ name: i.name, qty: i.qty, price: i.selling_price, gstRate: i.gst_rate })),
      subtotal,
      gstTotal,
      discountAmt,
      discountPct,
      grandTotal,
      payment,
      customerName: customerName.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
  };

  const printBill = () => {
    window.print();
  };

  const downloadPDF = () => {
    if (!lastBill) return;
    downloadInvoicePDF(
      {
        invoice_number: lastBill.invoice_number,
        createdAt: lastBill.createdAt,
        items: lastBill.items,
        subtotal: lastBill.subtotal,
        gstTotal: lastBill.gstTotal,
        discountAmt: lastBill.discountAmt,
        discountPct: lastBill.discountPct,
        grandTotal: lastBill.grandTotal,
        payment: lastBill.payment,
        customerName: lastBill.customerName,
      },
      {
        name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Maa Ka Aashirwad Supermarket",
        address: process.env.NEXT_PUBLIC_STORE_ADDRESS,
        gstin: process.env.NEXT_PUBLIC_STORE_GSTIN,
      }
    );
  };

  const newSale = () => {
    setCart([]);
    setDiscountPct(0);
    setCustomerName("");
    setLastBill(null);
  };

  const paymentOptions = [
    { key: "cash" as const, icon: Banknote, label: "Cash" },
    { key: "upi" as const, icon: Smartphone, label: "UPI" },
    { key: "card" as const, icon: CreditCard, label: "Card" },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 p-5 md:p-6 overflow-y-auto print:hidden">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product, barcode or SKU…"
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const low = p.current_stock <= p.min_stock;
            const status = expiryStatus(p.expiry_date);
            const expired = status === "expired";
            const nearExpiry = status === "warning-20";
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.current_stock <= 0 || expired}
                className="text-left bg-surface border border-border rounded-lg p-3.5 hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed group relative"
              >
                {expired && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-bad/20 text-bad">EXPIRED</span>
                )}
                {!expired && nearExpiry && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F2A93B]/20 text-[#F2A93B] flex items-center gap-0.5">
                    <AlertTriangle size={10} /> Soon
                  </span>
                )}
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-medium leading-snug pr-10">{p.name}</span>
                  {!expired && <Plus size={14} className="text-muted group-hover:text-accent shrink-0 mt-0.5" />}
                </div>
                <div className="text-xs text-muted font-mono mt-1">{p.sku}</div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-base font-bold font-mono text-accent">{fmtINR(p.selling_price)}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${low ? "bg-bad/15 text-bad" : "bg-good/15 text-good"}`}>
                    {p.current_stock} {p.unit}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted col-span-full">No products match — seed your catalog via the Products page or Supabase.</p>}
        </div>
      </div>

      <div className="w-full lg:w-[380px] bg-base border-t lg:border-t-0 lg:border-l border-border flex flex-col shrink-0">
        {!lastBill ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between print:hidden">
              <h2 className="font-semibold font-display flex items-center gap-2">
                <ShoppingCart size={17} /> Cart
              </h2>
              <span className="text-xs text-muted font-mono">{cart.length} items</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px] print:hidden">
              {cart.length === 0 && <div className="text-center text-sm text-muted mt-10">Tap a product to add it to the bill.</div>}
              {cart.map((i) => (
                <div key={i.id} className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{i.name}</div>
                    <div className="text-xs text-muted font-mono">{fmtINR(i.selling_price)} × {i.qty}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => changeQty(i.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-surface border border-border hover:border-accent">
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-mono">{i.qty}</span>
                    <button onClick={() => changeQty(i.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-surface border border-border hover:border-accent">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => changeQty(i.id, -i.qty)} className="w-6 h-6 flex items-center justify-center rounded text-bad hover:bg-bad/10 ml-0.5">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-3 print:hidden">
              <div className="flex items-center gap-2">
                <User size={13} className="text-muted shrink-0" />
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-2">
                <Percent size={13} className="text-muted" />
                <span className="text-xs text-muted">Discount</span>
                <input type="range" min={0} max={20} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="flex-1 accent-accent" />
                <span className="text-xs font-mono text-accent w-8 text-right">{discountPct}%</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {paymentOptions.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setPayment(key)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-colors ${
                      payment === key ? "bg-accent/15 border-accent text-accent" : "bg-surface border-border text-muted hover:border-accent/40"
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-1 pt-1 text-sm">
                <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-mono">{fmtINR(subtotal)}</span></div>
                <div className="flex justify-between text-muted"><span>GST</span><span className="font-mono">{fmtINR(gstTotal)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between text-bad"><span>Discount</span><span className="font-mono">−{fmtINR(discountAmt)}</span></div>}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border mt-1">
                  <span>Total</span><span className="font-mono text-accent">{fmtINR(grandTotal)}</span>
                </div>
              </div>

              <button
                onClick={chargeBill}
                disabled={cart.length === 0 || charging}
                className="w-full bg-accent text-base font-semibold text-sm py-3 rounded-lg hover:brightness-105 disabled:opacity-40 transition"
              >
                {charging ? "Processing…" : `Charge ${cart.length > 0 ? fmtINR(grandTotal) : ""}`}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3 text-good print:hidden">
              <CheckCircle2 size={16} />
              <span className="text-sm font-medium">Payment received</span>
            </div>
            <Receipt bill={lastBill} />
            <div className="grid grid-cols-2 gap-2 mt-4 print:hidden">
              <button onClick={printBill} className="flex items-center justify-center gap-1.5 bg-surface border border-border text-sm py-2.5 rounded-lg hover:border-accent transition">
                <Printer size={15} /> Print Bill
              </button>
              <button onClick={downloadPDF} className="flex items-center justify-center gap-1.5 bg-surface border border-border text-sm py-2.5 rounded-lg hover:border-accent transition">
                <Download size={15} /> Download PDF
              </button>
            </div>
            <button onClick={newSale} className="w-full mt-2 bg-accent text-base font-semibold text-sm py-3 rounded-lg hover:brightness-105 transition print:hidden">
              New Sale
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
