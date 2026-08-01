"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings as SettingsIcon, Save, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StoreSettings, Profile } from "@/types/database";

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<Partial<StoreSettings>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const [{ data: settingsData }, { data: profilesData }] = await Promise.all([
      supabase.from("store_settings").select("*").eq("id", 1).single(),
      supabase.from("profiles").select("*").order("full_name"),
    ]);
    setSettings(settingsData ?? null);
    setForm(settingsData ?? {});
    setProfiles(profilesData ?? []);
    setMyProfile((profilesData ?? []).find((p) => p.id === userData.user?.id) ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = myProfile?.role === "admin";

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("store_settings")
      .update({
        store_name: form.store_name,
        address: form.address ?? null,
        gstin: form.gstin ?? null,
        pan: form.pan ?? null,
        phone: form.phone ?? null,
        email: form.email ?? null,
        logo_url: form.logo_url ?? null,
        invoice_prefix: form.invoice_prefix,
        default_gst_rate: form.default_gst_rate,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    alert("Settings saved.");
  };

  const changeRole = async (profileId: string, role: "admin" | "staff") => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  };

  if (loading) return <div className="p-8 text-muted text-sm">Loading settings…</div>;

  return (
    <div className="p-5 md:p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon size={20} />
        <h1 className="text-2xl font-bold font-display">Settings</h1>
      </div>

      {!isAdmin && (
        <div className="bg-[#F2A93B]/10 border border-[#F2A93B]/30 text-[#F2A93B] text-sm rounded-lg px-4 py-3">
          You're signed in as staff — settings are view-only. Ask an admin to make changes here.
        </div>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4">General Settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Store Name" value={form.store_name ?? ""} onChange={(v) => setForm({ ...form, store_name: v })} disabled={!isAdmin} />
          <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} disabled={!isAdmin} />
          <Field label="Email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} disabled={!isAdmin} />
          <Field label="GSTIN" value={form.gstin ?? ""} onChange={(v) => setForm({ ...form, gstin: v })} disabled={!isAdmin} />
          <Field label="PAN" value={form.pan ?? ""} onChange={(v) => setForm({ ...form, pan: v })} disabled={!isAdmin} />
          <Field label="Logo URL" value={form.logo_url ?? ""} onChange={(v) => setForm({ ...form, logo_url: v })} disabled={!isAdmin} />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-muted mb-1">Address</label>
          <textarea
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            disabled={!isAdmin}
            rows={2}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
          />
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4">Billing Settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Invoice Prefix" value={form.invoice_prefix ?? ""} onChange={(v) => setForm({ ...form, invoice_prefix: v })} disabled={!isAdmin} />
          <Field
            label="Default GST Rate (%)"
            value={String(form.default_gst_rate ?? "")}
            onChange={(v) => setForm({ ...form, default_gst_rate: Number(v) || 0 })}
            type="number"
            disabled={!isAdmin}
          />
        </div>
        <p className="text-xs text-muted mt-2">
          Thermal printer size selection, auto-print, barcode/QR toggles, and round-off aren't wired up to app behavior yet — these would need to be built into the POS/invoice code, not just stored as settings.
        </p>
      </section>

      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={saveSettings} disabled={saving} className="flex items-center gap-1.5 bg-accent text-base font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-105 disabled:opacity-50">
            <Save size={15} /> {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4 flex items-center gap-2">
          <Users size={16} /> User Management
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Phone</th>
              <th className="py-2 font-medium text-right">Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="py-2">{p.full_name}</td>
                <td className="py-2 text-muted text-xs">{p.phone ?? "—"}</td>
                <td className="py-2 text-right">
                  {isAdmin ? (
                    <select
                      value={p.role}
                      onChange={(e) => changeRole(p.id, e.target.value as "admin" | "staff")}
                      className="bg-base border border-border rounded px-2 py-1 text-xs outline-none focus:border-accent"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-xs capitalize px-2 py-0.5 rounded bg-surface-elevated">{p.role}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted mt-3">
          New staff accounts are created directly in Supabase Authentication (see README) — this app doesn't have an "invite user" flow yet. Manager/Cashier as distinct roles aren't implemented either — currently only Admin and Staff exist.
        </p>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 opacity-60">
        <h2 className="font-semibold font-display mb-2">Not yet implemented</h2>
        <p className="text-xs text-muted">
          Appearance (theme/color), Backup &amp; Restore, Notification toggles, Two-Factor Authentication, and System Health status aren't built. These would each need real functionality behind them — a settings toggle with no effect would be misleading, so they're left out rather than faked.
        </p>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
      />
    </div>
  );
}
