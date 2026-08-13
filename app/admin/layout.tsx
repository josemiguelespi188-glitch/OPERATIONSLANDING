"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { AdminAuthContext } from "@/components/admin/AdminAuthContext";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Supabase is not configured.");
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  function signOut() {
    getSupabaseBrowserClient().auth.signOut();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-axis-light">
        <p className="text-sm text-axis-core/50">Loading...</p>
      </main>
    );
  }

  if (configError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-axis-light px-4">
        <p className="max-w-sm rounded-[8px] bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {configError}
        </p>
      </main>
    );
  }

  if (!session) {
    return <AdminLoginForm />;
  }

  return (
    <AdminAuthContext.Provider value={{ session, signOut }}>
      <main className="min-h-screen bg-axis-light">
        <header className="border-b border-axis-base/30 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-8">
              <Link href="/">
                <Logo />
              </Link>
              <nav className="flex items-center gap-1">
                <Link
                  href="/admin"
                  className="rounded-[6px] px-3 py-1.5 text-sm font-semibold text-axis-core transition-colors hover:bg-axis-light"
                >
                  Overview
                </Link>
                <Link
                  href="/admin/forms"
                  className="rounded-[6px] px-3 py-1.5 text-sm font-semibold text-axis-core transition-colors hover:bg-axis-light"
                >
                  Form Builder
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-axis-core/55 sm:inline">
                {session.user.email}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-[8px] border border-axis-base/50 px-3 py-1.5 text-sm font-semibold text-axis-core/70 transition-colors hover:border-axis-core hover:text-axis-core"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
      </main>
    </AdminAuthContext.Provider>
  );
}
