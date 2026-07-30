import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Use this in Client Components ("use client"). It automatically shares the
// auth session (cookies) set by the server client below.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
