"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AdminAuthContext } from "@/components/admin/AdminAuthContext";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { PageShell } from "@/components/layout/PageShell";
import { getAdminNavItems } from "@/components/layout/nav";
import { LogoutIcon } from "@/components/layout/icons";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const pathname = usePathname();

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
      <main className="flex min-h-screen items-center justify-center bg-axis-cream">
        <p className="text-sm text-axis-core/50">Loading...</p>
      </main>
    );
  }

  if (configError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-axis-cream px-4">
        <p className="max-w-sm rounded-[8px] bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {configError}
        </p>
      </main>
    );
  }

  if (!session) {
    return <AdminLoginForm />;
  }

  const active = pathname?.startsWith("/admin/forms") ? "forms" : "overview";
  const initial = session.user.email?.[0]?.toUpperCase() ?? "A";

  return (
    <AdminAuthContext.Provider value={{ session, signOut }}>
      <PageShell
        navItems={getAdminNavItems(active)}
        footer={
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-axis-signal text-xs font-bold text-axis-core">
                {initial}
              </span>
              <span className="truncate text-xs font-medium text-white/80">{session.user.email}</span>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="shrink-0 rounded-[6px] p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="mx-auto max-w-5xl px-10 py-10">{children}</div>
      </PageShell>
    </AdminAuthContext.Provider>
  );
}
