-- ============================================================================
-- Maa Ka Aashirwad Supermarket — ERP schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Profiles (extends auth.users) — role-based access control
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'staff');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'staff',
  phone text,
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever a new auth user signs up
create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Store settings (single row, admin-editable)
-- ----------------------------------------------------------------------------
create table store_settings (
  id int primary key default 1,
  store_name text not null default 'Maa Ka Aashirwad Supermarket',
  logo_url text,
  gstin text,
  address text,
  phone text,
  default_gst_rate numeric(5,2) default 5,
  invoice_prefix text default 'INV',
  next_invoice_seq int default 1,
  constraint single_row check (id = 1)
);
insert into store_settings (id) values (1);

-- ----------------------------------------------------------------------------
-- 3. Suppliers
-- ----------------------------------------------------------------------------
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  mobile text,
  email text,
  address text,
  gstin text,
  pending_payment numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Products
-- ----------------------------------------------------------------------------
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  barcode text unique,
  sku text unique not null,
  category_id uuid references categories(id),
  brand text,
  unit text not null default 'pcs',
  purchase_price numeric(10,2) not null default 0,
  selling_price numeric(10,2) not null default 0,
  gst_rate numeric(5,2) not null default 5,
  current_stock numeric(10,2) not null default 0,
  min_stock numeric(10,2) not null default 0,
  supplier_id uuid references suppliers(id),
  image_url text,
  mfg_date date,
  expiry_date date,
  batch_number text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_idx on products using gin (to_tsvector('english', name));
create index products_barcode_idx on products (barcode);

-- ----------------------------------------------------------------------------
-- 5. Customers
-- ----------------------------------------------------------------------------
create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  mobile text unique,
  email text,
  address text,
  gstin text,
  loyalty_points int not null default 0,
  pending_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. Sales (POS bills) — the core real-time table
-- ----------------------------------------------------------------------------
create type payment_method as enum ('cash', 'upi', 'card', 'split');
create type sale_status as enum ('completed', 'refunded', 'partial_refund');

create table sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  customer_id uuid references customers(id),
  cashier_id uuid references profiles(id),
  subtotal numeric(12,2) not null,
  gst_total numeric(12,2) not null,
  discount_pct numeric(5,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null,
  payment_method payment_method not null,
  status sale_status not null default 'completed',
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null, -- snapshot at time of sale
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  gst_rate numeric(5,2) not null,
  line_total numeric(12,2) not null
);

-- ----------------------------------------------------------------------------
-- 7. Stock movements — every stock change is logged here (audit trail)
-- ----------------------------------------------------------------------------
create type stock_movement_type as enum (
  'sale', 'purchase', 'adjustment', 'damaged', 'expired', 'purchase_return', 'sales_return'
);

create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id),
  type stock_movement_type not null,
  quantity_change numeric(10,2) not null, -- negative for outgoing
  reference_id uuid, -- e.g. sale_id or purchase_id
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. Purchases
-- ----------------------------------------------------------------------------
create table purchases (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references suppliers(id),
  invoice_number text not null,
  total_amount numeric(12,2) not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(10,2) not null,
  purchase_price numeric(10,2) not null,
  gst_rate numeric(5,2) not null,
  line_total numeric(12,2) not null
);

-- ----------------------------------------------------------------------------
-- 9. Function + trigger: auto-decrement stock & log movement on sale insert
-- ----------------------------------------------------------------------------
create function apply_sale_item_stock() returns trigger as $$
begin
  update products set current_stock = current_stock - new.quantity, updated_at = now()
    where id = new.product_id;
  insert into stock_movements (product_id, type, quantity_change, reference_id, note)
    values (new.product_id, 'sale', -new.quantity, new.sale_id, 'POS sale');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_sale_item_insert
  after insert on sale_items
  for each row execute procedure apply_sale_item_stock();

-- restock on purchase
create function apply_purchase_item_stock() returns trigger as $$
begin
  update products set current_stock = current_stock + new.quantity, updated_at = now()
    where id = new.product_id;
  insert into stock_movements (product_id, type, quantity_change, reference_id, note)
    values (new.product_id, 'purchase', new.quantity, new.purchase_id, 'Purchase entry');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_purchase_item_insert
  after insert on purchase_items
  for each row execute procedure apply_purchase_item_stock();

-- ----------------------------------------------------------------------------
-- 9b. RPC: create_sale — atomically inserts a sale + its line items so a POS
--     checkout either fully succeeds or fully rolls back (no partial bills).
--     Call from the client with supabase.rpc('create_sale', { payload }).
-- ----------------------------------------------------------------------------
create or replace function create_sale(payload jsonb) returns sales as $$
declare
  new_sale sales;
  item jsonb;
  seq int;
  prefix text;
begin
  select next_invoice_seq, invoice_prefix into seq, prefix from store_settings where id = 1 for update;

  insert into sales (
    invoice_number, customer_id, cashier_id, subtotal, gst_total,
    discount_pct, discount_amount, grand_total, payment_method
  ) values (
    prefix || '-' || seq,
    (payload->>'customer_id')::uuid,
    auth.uid(),
    (payload->>'subtotal')::numeric,
    (payload->>'gst_total')::numeric,
    (payload->>'discount_pct')::numeric,
    (payload->>'discount_amount')::numeric,
    (payload->>'grand_total')::numeric,
    (payload->>'payment_method')::payment_method
  ) returning * into new_sale;

  for item in select * from jsonb_array_elements(payload->'items') loop
    insert into sale_items (sale_id, product_id, product_name, quantity, unit_price, gst_rate, line_total)
    values (
      new_sale.id,
      (item->>'product_id')::uuid,
      item->>'product_name',
      (item->>'quantity')::numeric,
      (item->>'unit_price')::numeric,
      (item->>'gst_rate')::numeric,
      (item->>'line_total')::numeric
    );
  end loop;

  update store_settings set next_invoice_seq = seq + 1 where id = 1;

  return new_sale;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- 10. Row Level Security — every table requires an authenticated store user;
--     write access to sensitive settings/master data is admin-only.
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table store_settings enable row level security;
alter table suppliers enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_movements enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;

create function is_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer;

-- profiles: everyone can read all profiles (for staff lists); only admins edit
create policy "profiles readable by authenticated" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles editable by admin" on profiles for update using (is_admin());

-- store_settings: readable by all staff, editable by admin only
create policy "settings readable" on store_settings for select using (auth.role() = 'authenticated');
create policy "settings editable by admin" on store_settings for update using (is_admin());

-- master data (products/categories/suppliers/customers): all staff read+write
-- (staff need to add stock/customers during billing); tighten per your policy needs
create policy "products rw authenticated" on products for all using (auth.role() = 'authenticated');
create policy "categories rw authenticated" on categories for all using (auth.role() = 'authenticated');
create policy "suppliers rw authenticated" on suppliers for all using (auth.role() = 'authenticated');
create policy "customers rw authenticated" on customers for all using (auth.role() = 'authenticated');

-- transactional data: all staff can create; only admin can delete/void
create policy "sales rw authenticated" on sales for select using (auth.role() = 'authenticated');
create policy "sales insert authenticated" on sales for insert with check (auth.role() = 'authenticated');
create policy "sales delete admin" on sales for delete using (is_admin());

create policy "sale_items rw authenticated" on sale_items for all using (auth.role() = 'authenticated');
create policy "stock_movements rw authenticated" on stock_movements for all using (auth.role() = 'authenticated');
create policy "purchases rw authenticated" on purchases for all using (auth.role() = 'authenticated');
create policy "purchase_items rw authenticated" on purchase_items for all using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 11. Enable realtime on the tables the dashboard/POS subscribe to
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table sale_items;
alter publication supabase_realtime add table stock_movements;

-- ----------------------------------------------------------------------------
-- 12. Seed categories (edit / extend as needed)
-- ----------------------------------------------------------------------------
insert into categories (name) values
  ('Grocery'), ('Dairy'), ('Snacks'), ('Beverages'), ('Personal Care'), ('Household');
