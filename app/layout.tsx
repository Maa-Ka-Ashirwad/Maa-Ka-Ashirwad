import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maa Ka Aashirwad Supermarket — ERP",
  description: "Real-time billing, inventory and reporting for Maa Ka Aashirwad Supermarket",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-base text-ink font-body antialiased">{children}</body>
    </html>
  );
}
