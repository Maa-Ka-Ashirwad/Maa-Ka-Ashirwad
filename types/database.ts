// Hand-written types matching supabase/schema.sql.
// Once your project is live, replace this file with generated types:
//   npx supabase gen types typescript --project-id <ref> > types/database.ts

export type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string;
  category_id: string | null;
  brand: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  gst_rate: number;
  current_stock: number;
  min_stock: number;
  supplier_id: string | null;
  image_url: string | null;
  mfg_date: string | null;
  expiry_date: string | null;
  batch_number: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = { id: string; name: string };

export type Customer = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  loyalty_points: number;
  pending_balance: number;
  created_at: string;
};

export type Sale = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  cashier_id: string | null;
  subtotal: number;
  gst_total: number;
  discount_pct: number;
  discount_amount: number;
  grand_total: number;
  payment_method: "cash" | "upi" | "card" | "split";
  status: "completed" | "refunded" | "partial_refund";
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  line_total: number;
};

export type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "staff";
  phone: string | null;
  created_at: string;
};

export type StoreSettings = {
  id: number;
  store_name: string;
  logo_url: string | null;
  gstin: string | null;
  address: string | null;
  phone: string | null;
  default_gst_rate: number;
  invoice_prefix: string;
  next_invoice_seq: number;
};

// Generic Database shape so `createBrowserClient<Database>()` type-checks.
// Not exhaustive — extend as you add tables, or swap in generated types.
export type Database = {
  public: {
    Tables: {
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      customers: { Row: Customer; Insert: Partial<Customer>; Update: Partial<Customer> };
      sales: { Row: Sale; Insert: Partial<Sale>; Update: Partial<Sale> };
      sale_items: { Row: SaleItem; Insert: Partial<SaleItem>; Update: Partial<SaleItem> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      store_settings: { Row: StoreSettings; Insert: Partial<StoreSettings>; Update: Partial<StoreSettings> };
    };
  };
};
