"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Package, FileBarChart2, Users, Truck, Settings, LogOut, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Billing (POS)", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/expiry", label: "Expiry Alerts", icon: AlertTriangle },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={`fixed lg:static z-30 inset-y-0 left-0 w-64 bg-[#0D1615] border-r border-border flex flex-col transition-transform ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-base font-bold font-display">M</div>
          <div>
            <div className="font-bold font-display leading-tight text-sm">Maa Ka Aashirwad</div>
            <div className="text-muted text-[10px] tracking-wider uppercase">Supermarket ERP</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "bg-accent text-base font-semibold" : "text-[#B9C7C3] hover:bg-surface-elevated hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              <span className="font-display">{label}</span>
            </Link>
          );
        })}
      </nav>

      <button onClick={signOut} className="m-3 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-bad hover:bg-bad/10">
        <LogOut size={16} /> Sign out
      </button>
    </aside>
  );
}
