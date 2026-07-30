// Populates sample products so the app isn't empty on first run.
// Usage: npm run seed   (requires .env.local with service role key)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
  process.exit(1);
}

const supabase = createClient(url, key);

const PRODUCTS = [
  { name: "Basmati Rice 5kg", sku: "GRC-1001", unit: "bag", purchase_price: 420, selling_price: 480, gst_rate: 5, current_stock: 34, min_stock: 10 },
  { name: "Toor Dal 1kg", sku: "GRC-1002", unit: "pkt", purchase_price: 140, selling_price: 165, gst_rate: 5, current_stock: 8, min_stock: 15 },
  { name: "Sunflower Oil 1L", sku: "GRC-1003", unit: "btl", purchase_price: 130, selling_price: 152, gst_rate: 5, current_stock: 42, min_stock: 12 },
  { name: "Amul Toned Milk 500ml", sku: "DRY-2001", unit: "pkt", purchase_price: 24, selling_price: 27, gst_rate: 0, current_stock: 60, min_stock: 20 },
  { name: "Paneer 200g", sku: "DRY-2002", unit: "pkt", purchase_price: 75, selling_price: 90, gst_rate: 5, current_stock: 6, min_stock: 10 },
  { name: "Lays Classic 52g", sku: "SNK-3001", unit: "pkt", purchase_price: 16, selling_price: 20, gst_rate: 12, current_stock: 90, min_stock: 30 },
  { name: "Parle-G Biscuit 200g", sku: "SNK-3002", unit: "pkt", purchase_price: 20, selling_price: 25, gst_rate: 18, current_stock: 5, min_stock: 20 },
  { name: "Coca-Cola 750ml", sku: "BEV-4001", unit: "btl", purchase_price: 36, selling_price: 45, gst_rate: 28, current_stock: 38, min_stock: 15 },
  { name: "Tata Tea Gold 250g", sku: "BEV-4002", unit: "pkt", purchase_price: 118, selling_price: 140, gst_rate: 5, current_stock: 22, min_stock: 10 },
  { name: "Colgate Toothpaste 150g", sku: "PC-5001", unit: "tube", purchase_price: 78, selling_price: 95, gst_rate: 18, current_stock: 27, min_stock: 10 },
  { name: "Surf Excel 1kg", sku: "HH-6001", unit: "pkt", purchase_price: 118, selling_price: 145, gst_rate: 18, current_stock: 19, min_stock: 10 },
];

async function main() {
  const { error } = await supabase.from("products").insert(PRODUCTS);
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);
}

main();
