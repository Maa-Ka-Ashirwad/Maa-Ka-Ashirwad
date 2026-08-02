// Hand-written types matching supabase/schema.sql.
// Once your project is live, replace this file with generated types:
//   npx supabase gen types typescript --project-id <ref> > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
  purchase_date: string | null;
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

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  pending_payment: number;
  created_at: string;
};

export type Purchase = {
  id: string;
  supplier_id: string;
  invoice_number: string;
  total_amount: number;
  created_by: string | null;
  created_at: string;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  purchase_price: number;
  gst_rate: number;
  line_total: number;
};

export type StockMovement = {
  id: string;
  product_id: string;
  type: "sale" | "purchase" | "adjustment" | "damaged" | "expired" | "purchase_return" | "sales_return";
  quantity_change: number;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
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
  email: string | null;
  pan: string | null;
  default_gst_rate: number;
  invoice_prefix: string;
  next_invoice_seq: number;
};

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  record_info: string | null;
  created_at: string;
};

// Helper so every table follows the exact shape @supabase/supabase-js expects:
// Row / Insert / Update / Relationships. Without Relationships, or without this
// full shape on the Database type below (Views/Functions/Enums/CompositeTypes),
// supabase-js's generics silently fall back to `never`, which is why
// `.insert()` and `.rpc()` calls were being rejected by TypeScript.
type Table<Row, InsertDefaults extends object = {}> = {
  Row: Row;
  Insert: Partial<Row> & InsertDefaults;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      products: Table<Product, { name: string; sku: string }>;
      categories: Table<Category, { name: string }>;
      customers: Table<Customer, { name: string }>;
      suppliers: Table<Supplier, { name: string }>;
      purchases: Table<Purchase, { supplier_id: string; invoice_number: string; total_amount: number }>;
      purchase_items: Table<
        PurchaseItem,
        { purchase_id: string; product_id: string; quantity: number; purchase_price: number; gst_rate: number; line_total: number }
      >;
      sales: Table<
        Sale,
        { invoice_number: string; subtotal: number; gst_total: number; grand_total: number; payment_method: Sale["payment_method"] }
      >;
      sale_items: Table<
        SaleItem,
        { sale_id: string; product_id: string; product_name: string; quantity: number; unit_price: number; gst_rate: number; line_total: number }
      >;
      stock_movements: Table<StockMovement, { product_id: string; type: StockMovement["type"]; quantity_change: number }>;
      profiles: Table<Profile, { id: string; full_name: string }>;
      store_settings: Table<StoreSettings, {}>;
      audit_log: Table<AuditLogRow, { action: string; module: string }>;
    };
    Views: {};
    Functions: {
      create_sale: {
        Args: { payload: Json };
        Returns: Sale;
      };
      is_admin: {
        Args: {};
        Returns: boolean;
      };
      verify_security_password: {
        Args: { input_password: string };
        Returns: boolean;
      };
      has_security_password: {
        Args: {};
        Returns: boolean;
      };
      set_security_password: {
        Args: { old_password: string | null; new_password: string };
        Returns: void;
      };
      get_masked_security_email: {
        Args: {};
        Returns: string;
      };
      change_security_email: {
        Args: { current_security_password: string; new_email: string };
        Returns: void;
      };
      secure_delete_product: {
        Args: { product_id: string; security_password: string };
        Returns: void;
      };
      secure_update_store_settings: {
        Args: {
          security_password: string;
          p_store_name: string;
          p_address: string | null;
          p_gstin: string | null;
          p_pan: string | null;
          p_phone: string | null;
          p_email: string | null;
          p_logo_url: string | null;
          p_invoice_prefix: string;
          p_default_gst_rate: number;
        };
        Returns: void;
      };
      secure_change_role: {
        Args: { security_password: string; target_profile_id: string; new_role: string };
        Returns: void;
      };
    };
    Enums: {
      user_role: "admin" | "staff";
      payment_method: "cash" | "upi" | "card" | "split";
      sale_status: "completed" | "refunded" | "partial_refund";
      stock_movement_type: "sale" | "purchase" | "adjustment" | "damaged" | "expired" | "purchase_return" | "sales_return";
    };
    CompositeTypes: {};
  };
};
