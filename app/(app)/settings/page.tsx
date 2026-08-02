"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings as SettingsIcon, Save, Users, Shield, ScrollText } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { StoreSettings, Profile } from "@/types/database";

export default function SettingsPage() {
  const supabase = createClient();
  const [form, setForm] = useState<Partial<StoreSettings>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSecurityPassword, setHasSecurityPassword] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const [{ data: settingsData }, { data: profilesData }, { data: maskedEmailData }, { data: hasPwData }] = await Promise.all([
      supabase.from("store_settings").select("*").eq("id", 1).single(),
      supabase.from("profiles").select("*").order("full_name"),
      supabase.rpc("get_masked_security_email"),
      supabase.rpc("has_security_password"),
    ]);
    setForm(settingsData ?? {});
    setProfiles(profilesData ?? []);
    setMaskedEmail((maskedEmailData as unknown as string) ?? null);
    setHasSecurityPassword((hasPwData as unknown as boolean) ?? false);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async () => {
    const password = prompt("Enter security password to save settings:");
    if (!password) return;
    setSaving(true);
    const { error } = await supabase.rpc("secure_update_store_settings", {
      security_password: password,
      p_store_name: form.store_name ?? "",
      p_address: form.address ?? null,
      p_gstin: form.gstin ?? null,
      p_pan: form.pan ?? null,
      p_phone: form.phone ?? null,
      p_email: form.email ?? null,
      p_logo_url: form.logo_url ?? null,
      p_invoice_prefix: form.invoice_prefix ?? "",
      p_default_gst_rate: form.default_gst_rate ?? 0,
    });
    setSaving(false);
    if (error) {
      alert(error.message.includes("Incorrect") ? "Incorrect security password." : error.message);
      return;
    }
    alert("Settings saved.");
  };

  const changeRole = async (profileId: string, currentRole: string, newRole: "admin" | "staff") => {
    if (newRole === currentRole) return;
    const password = prompt(`Enter security password to change this user's role to ${newRole}:`);
    if (!password) {
      load(); // reset the <select> back to its actual value
      return;
    }
    const { error } = await supabase.rpc("secure_change_role", { security_password: password, target_profile_id: profileId, new_role: newRole });
    if (error) {
      alert(error.message.includes("Incorrect") ? "Incorrect security password." : error.message);
      load();
      return;
    }
    load();
  };

  const setOrChangeSecurityPassword = async () => {
    const isFirstTime = hasSecurityPassword === false;
    let oldPassword: string | null = null;
    if (!isFirstTime) {
      oldPassword = prompt("Enter current security password:");
      if (!oldPassword) return;
    }
    const newPassword = prompt("Enter new security password (min 4 characters):");
    if (!newPassword) return;
    const confirmPassword = prompt("Confirm new security password:");
    if (newPassword !== confirmPassword) {
      alert("Passwords don't match.");
      return;
    }
    const { error } = await supabase.rpc("set_security_password", { old_password: oldPassword, new_password: newPassword });
    if (error) {
      alert(error.message.includes("Incorrect") ? "Incorrect current security password." : error.message);
      return;
    }
    alert("Security password saved.");
    setHasSecurityPassword(true);
  };

  const changeSecurityEmail = async () => {
    const password = prompt("Enter security password to change the registered security email:");
    if (!password) return;
    const newEmail = prompt("Enter new security email address:");
    if (!newEmail) return;
    const { error } = await supabase.rpc("change_security_email", { current_security_password: password, new_email: newEmail });
    if (error) {
      alert(error.message.includes("Incorrect") ? "Incorrect security password." : error.message);
      return;
    }
    alert("Security email updated.");
    load();
  };

  if (loading) return <div className="p-8 text-muted text-sm">Loading settings…</div>;

  return (
    <div className="p-5 md:p-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon size={20} />
          <h1 className="text-2xl font-bold font-display">Settings</h1>
        </div>
        <Link href="/audit-log" className="flex items-center gap-1.5 text-xs text-muted hover:text-accent">
          <ScrollText size={14} /> View Audit Log
        </Link>
      </div>

      <div className="bg-surface-elevated border border-border text-muted text-sm rounded-lg px-4 py-3">
        Everyone can view and edit settings here — saving any change, or changing a user's role, will ask for the security password at that moment.
      </div>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4">General Settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Store Name" value={form.store_name ?? ""} onChange={(v) => setForm({ ...form, store_name: v })} />
          <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="GSTIN" value={form.gstin ?? ""} onChange={(v) => setForm({ ...form, gstin: v })} />
          <Field label="PAN" value={form.pan ?? ""} onChange={(v) => setForm({ ...form, pan: v })} />
          <Field label="Logo URL" value={form.logo_url ?? ""} onChange={(v) => setForm({ ...form, logo_url: v })} />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-muted mb-1">Address</label>
          <textarea
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4">Billing Settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Invoice Prefix" value={form.invoice_prefix ?? ""} onChange={(v) => setForm({ ...form, invoice_prefix: v })} />
          <Field
            label="Default GST Rate (%)"
            value={String(form.default_gst_rate ?? "")}
            onChange={(v) => setForm({ ...form, default_gst_rate: Number(v) || 0 })}
            type="number"
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={saveSettings} disabled={saving} className="flex items-center gap-1.5 bg-accent text-base font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-105 disabled:opacity-50">
          <Save size={15} /> {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold font-display mb-4 flex items-center gap-2">
          <Shield size={16} /> Security
        </h2>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <div className="text-sm">Security Password</div>
            <div className="text-xs text-muted">Separate from your login password — protects sensitive actions.</div>
          </div>
          <button onClick={setOrChangeSecurityPassword} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent">
            {hasSecurityPassword === false ? "Set Password" : "Change Password"}
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm">Registered Security Email</div>
            <div className="text-xs text-muted">{maskedEmail ?? "Not set yet"}</div>
          </div>
          <button onClick={changeSecurityEmail} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent">
            Change
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          Email-OTP verification of a newly entered security email isn't built yet — changing it currently only requires the security password.
        </p>
      </section>

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
                  <select
                    value={p.role}
                    onChange={(e) => changeRole(p.id, p.role, e.target.value as "admin" | "staff")}
                    className="bg-base border border-border rounded px-2 py-1 text-xs outline-none focus:border-accent"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 opacity-60">
        <h2 className="font-semibold font-display mb-2">Not yet implemented</h2>
        <p className="text-xs text-muted">
          Appearance (theme/color), Backup &amp; Restore, Notification toggles, Two-Factor Authentication, System Health status, and a per-page/per-widget "Protection Manager" aren't built yet.
        </p>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
