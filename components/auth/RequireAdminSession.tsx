"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AdminAuthContext } from "@/components/admin/AdminAuthContext";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

/**
 * The "must be signed in" gate shared by every page that requires the
 * same login as /admin -- originally just app/admin/layout.tsx's own
 * inline logic, factored out (Oct 2026) so /support-inquiry could reuse
 * it too once that page stopped being a no-login public tool (per
 * explicit instruction: "esta pagina debe tener acceso unicamente con
 * el autenticador"). Renders AdminLoginForm when there's no session,
 * otherwise provides AdminAuthContext (session + signOut) to children --
 * callers that want the full admin chrome (sidebar, nav) still add
 * PageShell themselves, same as app/admin/layout.tsx does; this
 * component only handles the auth check.
 */
export function RequireAdminSession({ children }: { children: React.ReactNode }) {
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

  return <AdminAuthContext.Provider value={{ session, signOut }}>{children}</AdminAuthContext.Provider>;
}
