"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    }
    // On success, the layout's onAuthStateChange listener picks up the new
    // session and swaps this form out for the admin content.
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-axis-light px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-axis-base/30 bg-white p-8 shadow-card"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
        <h1 className="mt-1.5 font-head text-lg font-medium tracking-tight text-axis-core">
          Admin Portal
        </h1>
        <p className="mt-1.5 text-sm text-axis-core/60">
          Sign in to manage AxisKey Operations Hub.
        </p>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
            placeholder="you@axiskey.com"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
