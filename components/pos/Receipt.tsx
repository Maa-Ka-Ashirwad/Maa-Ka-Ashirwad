import { fmtINR } from "@/lib/format";

export type BillItem = { name: string; qty: number; price: number };

export function Receipt({
  bill,
}: {
  bill: {
    invoice_number: string;
    items: BillItem[];
    subtotal: number;
    gstTotal: number;
    discountAmt: number;
    discountPct: number;
    grandTotal: number;
    payment: string;
  };
}) {
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "Maa Ka Aashirwad Supermarket";
  const gstin = process.env.NEXT_PUBLIC_STORE_GSTIN ?? "";

  return (
    <div className="bg-ink text-base rounded-md p-4 font-mono text-xs">
      <div className="text-center mb-2">
        <div className="font-display font-bold text-sm tracking-wide uppercase">{storeName}</div>
        {gstin && <div className="text-[10px] mt-1 opacity-70">GSTIN {gstin}</div>}
      </div>
      <div className="border-t border-dashed border-base/40 my-2" />
      <div className="flex justify-between">
        <span>{bill.invoice_number}</span>
        <span>{new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
      <div className="border-t border-dashed border-base/40 my-2" />
      {bill.items.map((i, idx) => (
        <div key={idx} className="flex justify-between py-0.5">
          <span className="truncate pr-2">{i.name} ×{i.qty}</span>
          <span className="shrink-0">{fmtINR(i.price * i.qty)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-base/40 my-2" />
      <div className="flex justify-between"><span>Subtotal</span><span>{fmtINR(bill.subtotal)}</span></div>
      <div className="flex justify-between"><span>GST</span><span>{fmtINR(bill.gstTotal)}</span></div>
      {bill.discountAmt > 0 && (
        <div className="flex justify-between"><span>Discount ({bill.discountPct}%)</span><span>−{fmtINR(bill.discountAmt)}</span></div>
      )}
      <div className="border-t border-dashed border-base/40 my-2" />
      <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{fmtINR(bill.grandTotal)}</span></div>
      <div className="flex justify-between mt-1 opacity-70 capitalize"><span>Paid via</span><span>{bill.payment}</span></div>
    </div>
  );
}
