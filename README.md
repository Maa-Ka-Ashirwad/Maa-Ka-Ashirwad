# Maa Ka Aashirwad Supermarket — ERP

A real-time, multi-user POS + inventory scaffold built with Next.js (App Router) and Supabase.
This is a **starter you run and extend**, not a finished product — it wires up the hard
infrastructure (auth, real-time sync, database, atomic checkout) correctly so you can
focus on adding the remaining screens (Customers, Suppliers, Reports, Settings).

## What's actually working end-to-end

- **Auth** — Supabase email/password, session-aware middleware, protected routes
- **Products** — live table + "Add product" form, backed by Postgres
- **Billing (POS)** — real cart, GST + discount math, atomic checkout via a Postgres
  RPC (`create_sale`) that inserts the bill, line items, and decrements stock in one
  transaction — so a half-completed sale can never corrupt your stock count
- **Dashboard** — live KPIs and a 7-day revenue chart computed from real `sales` rows
- **Real-time sync** — every client subscribes to Postgres changes on `products` and
  `sales`. Sell an item on one till, and the stock count and dashboard update on every
  other logged-in device with no refresh. A presence channel also shows how many staff
  are online right now.

## What's scaffolded but not built out

`Customers`, `Suppliers`, `Reports`, `Settings` are stub pages with a comment pointing
you to `app/(app)/products/page.tsx` as the pattern to copy: a Supabase query + a
`postgres_changes` subscription in a client component. The schema already has the
tables (`customers`, `suppliers`, `purchases`, `purchase_items`, `store_settings`) —
only the UI is left.

Also not built: barcode scanning (needs a hardware/camera integration), Excel
import/export, WhatsApp/email invoice delivery, PDF generation, and the audit-log UI
(the `stock_movements` table already logs every change — you just need a page to
display it).

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. In **Project Settings → API**, copy the Project URL and `anon` public key.
3. In the **SQL Editor**, paste the entire contents of `supabase/schema.sql` and run
   it. This creates every table, the `create_sale` RPC, row-level security policies,
   and turns on realtime for `products`, `sales`, `sale_items`, and `stock_movements`.
4. In **Authentication → Providers**, make sure Email is enabled.
5. In **Authentication → Users**, click "Add user" to create your first admin login
   (email + password). Then in the SQL editor run:
   ```sql
   update profiles set role = 'admin' where id = '<the new user's UUID>';
   ```
   (every new signup gets a `profiles` row automatically, defaulting to `staff` —
   see the `handle_new_user` trigger in the schema).

## 2. Configure the app locally

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# (SUPABASE_SERVICE_ROLE_KEY is only needed for the seed script — get it from
#  Project Settings → API → service_role. Never expose it to the browser.)

npm install
npm run seed   # optional — loads ~11 sample products so POS isn't empty
npm run dev
```

Visit `http://localhost:3000`, sign in with the admin account you created, and you're
in. Open the same URL in a second browser (or incognito window) signed in as a second
user to see real-time sync between two "tills."

## 3. Deploy

- **Frontend**: push this repo to GitHub, import it into [Vercel](https://vercel.com),
  and add the same three env vars from `.env.local` in the Vercel project settings.
  Vercel auto-detects Next.js — no build config needed.
- **Database**: already live on Supabase from step 1. Nothing else to deploy.
- **PWA**: `public/manifest.json` is already wired into `app/layout.tsx`. For full
  offline support you'd add a service worker (e.g. via `next-pwa`) — not included here
  since offline-first POS with real-time sync needs careful conflict handling that's
  worth designing deliberately rather than bolting on.

## Project structure

```
app/
  login/                 — public auth page
  (app)/                 — authenticated route group, shares Sidebar + Topbar layout
    dashboard/           — live KPIs + revenue chart
    pos/                 — billing / checkout
    products/            — product catalog CRUD
    customers/ suppliers/ reports/ settings/  — stubs, same pattern as products/
components/
  layout/                — Sidebar, PresenceBadge
  dashboard/              — KPICard
  pos/                    — Receipt
lib/supabase/            — browser + server Supabase clients
supabase/schema.sql       — full DB schema, RLS policies, triggers, RPC
types/database.ts         — hand-written types (swap for `supabase gen types` later)
scripts/seed.ts            — sample data loader
```

## Design notes

The visual language (dark charcoal-teal base, marigold/saffron accent, monospace for
all prices and SKUs, the perforated thermal-receipt styling on the checkout screen)
carries over exactly from the click-through prototype, now driven by real data instead
of mock arrays — compare `components/pos/Receipt.tsx` to the prototype's receipt to see
the same design implemented against live Supabase rows.
