"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Supplier } from "@/types/database";
import { fmtINR } from "@/lib/format";

const emptyForm = { name: "", contact_person: "", mobile: "", email: "", address: "", gstin: "" };

export default function SuppliersPage() {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setSuppliers(data ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("suppliers-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "suppliers" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      name: form.name,
      contact_person: form.contact_person || null,
      mobile: form.mobile || null,
      email: form.email || null,
      address: form.address || null,
      gstin: form.gstin || null,
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
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Truck size={22} /> Suppliers
          </h1>
          <p className="text-sm text-muted mt-1">{suppliers.length} suppliers</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-accent text-base font-semibold text-sm px-3.5 py-2 rounded-lg hover:brightness-105">
          <Plus size={15} /> Add Supplier
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">GSTIN</th>
              <th className="px-4 py-3 font-medium text-right">Pending Payment</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.contact_person ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.mobile ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{s.gstin ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  <span className={s.pending_payment > 0 ? "text-bad" : "text-muted"}>{fmtINR(s.pending_payment)}</span>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No suppliers yet — add your first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold font-display">Add Supplier</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Supplier name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Contact person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
                <Field label="GSTIN" value={form.gstin} onChange={(v) => setForm({ ...form, gstin: v })} />
              </div>
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            </div>
            <button type="submit" disabled={saving} className="w-full mt-5 bg-accent text-base font-semibold text-sm py-2.5 rounded-lg hover:brightness-105 disabled:opacity-50">
              {saving ? "Saving…" : "Save supplier"}
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
