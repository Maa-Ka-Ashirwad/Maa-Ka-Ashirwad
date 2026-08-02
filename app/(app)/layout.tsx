"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { PresenceBadge } from "@/components/layout/PresenceBadge";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pos": "Billing (POS)",
  "/products": "Products",
  "/purchases": "Purchases",
  "/expiry": "Expiry Alerts",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/reports": "Reports",
  "/settings": "Settings",
  "/audit-log": "Audit Log",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="h-screen w-full bg-base flex overflow-hidden">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div onClick={() => setNavOpen(false)} className="fixed inset-0 bg-black/50 z-20 lg:hidden" />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => setNavOpen(true)} className="lg:hidden text-[#B9C7C3]">
              <Menu size={20} />
            </button>
            <span className="text-sm font-medium hidden sm:inline">{TITLES[pathname] ?? "Maa Ka Aashirwad"}</span>
          </div>
          <div className="flex-1 flex justify-center max-w-md mx-auto">
            <GlobalSearch />
          </div>
          <div className="shrink-0">
            <PresenceBadge />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
