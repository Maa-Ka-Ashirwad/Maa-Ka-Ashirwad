// Shared expiry-status logic so every screen (Products, Expiry Alerts, POS)
// calculates and colors expiry the same way.

export type ExpiryStatus = "healthy" | "warning-30" | "warning-20" | "expired" | "none";

export function daysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function expiryStatus(expiryDate: string | null): ExpiryStatus {
  const days = daysRemaining(expiryDate);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 20) return "warning-20";
  if (days <= 30) return "warning-30";
  return "healthy";
}

// Tailwind classes per status — 🟢 healthy, 🟡 <=30d, 🟠 <=20d, 🔴 expired
export function expiryColorClasses(status: ExpiryStatus): string {
  switch (status) {
    case "expired":
      return "bg-bad/15 text-bad";
    case "warning-20":
      return "bg-[#F2A93B]/20 text-[#F2A93B]";
    case "warning-30":
      return "bg-[#F2E33B]/15 text-[#D8C93B]";
    case "healthy":
      return "bg-good/15 text-good";
    default:
      return "bg-surface-elevated text-muted";
  }
}

export function expiryLabel(status: ExpiryStatus, days: number | null): string {
  if (status === "none") return "No expiry set";
  if (status === "expired") return `Expired ${Math.abs(days ?? 0)}d ago`;
  return `${days}d left`;
}
