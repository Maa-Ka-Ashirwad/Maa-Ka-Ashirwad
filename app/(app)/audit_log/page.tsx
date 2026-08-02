"use client";

import { useEffect, useState, useCallback } from "react";
import { ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_info: string | null;
  created_at: string;
};

export default function AuditLogPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: logData }, { data: profilesData }] = await Promise.all([
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("*"),
    ]);
    setRows((logData as unknown as AuditRow[]) ?? []);
    setProfiles(profilesData ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("audit-log-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const userName = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? "Unknown";

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      delete: "Deleted",
      update: "Updated",
      change_role: "Changed role",
      change_security_password: "Changed security password",
      change_security_email: "Changed security email",
    };
    return map[action] ?? action;
  };

  if (loading) return <div className="p-8 text-muted text-sm">Loading audit log…</div>;

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <ScrollText size={20} />
        <h1 className="text-2xl font-bold font-display">Audit Log</h1>
      </div>
      <p className="text-sm text-muted mb-5">Every sensitive action — deletions, settings changes, role changes — recorded here. Visible to everyone.</p>

      <div className="bg-surface border border-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Module</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium text-right">Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-elevated/60">
                <td className="px-4 py-3">{userName(r.user_id)}</td>
                <td className="px-4 py-3">{actionLabel(r.action)}</td>
                <td className="px-4 py-3 text-muted capitalize">{r.module}</td>
                <td className="px-4 py-3 text-muted text-xs">{r.record_info ?? "—"}</td>
                <td className="px-4 py-3 text-right text-xs font-mono text-muted">{new Date(r.created_at).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No security actions logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">
        Device and IP address aren't captured yet — that needs server-side request logging (a Next.js middleware or Edge Function), which isn't built. Only user, action, module, and timestamp are recorded currently.
      </p>
    </div>
  );
}
