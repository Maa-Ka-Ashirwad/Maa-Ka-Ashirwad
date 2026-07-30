"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-surface border border-border rounded-xl p-7">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center text-base font-bold font-display text-lg">M</div>
          <h1 className="mt-3 font-display font-bold text-lg text-center">Maa Ka Aashirwad</h1>
          <p className="text-muted text-xs uppercase tracking-wider">Supermarket ERP</p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">{error}</div>
        )}

        <label className="block text-xs text-muted mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm mb-4 outline-none focus:border-accent"
          placeholder="staff@store.com"
        />

        <label className="block text-xs text-muted mb-1.5">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm mb-6 outline-none focus:border-accent"
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-base font-semibold text-sm py-3 rounded-lg hover:brightness-105 disabled:opacity-50 transition"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-muted text-center mt-4">
          Accounts are created by your admin in Supabase Auth — see the README for setup.
        </p>
      </form>
    </div>
  );
}
