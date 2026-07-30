import type { LucideIcon } from "lucide-react";

export function KPICard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted font-medium">{label}</span>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
          <Icon size={15} color={accent} strokeWidth={2.2} />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono truncate">{value}</div>
    </div>
  );
}
