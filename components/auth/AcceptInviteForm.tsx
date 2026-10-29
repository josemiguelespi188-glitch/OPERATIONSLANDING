"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "saving" | "done" | "error";

const inputClass =
  "w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50";

/**
 * Supabase's invite link lands here with the session tokens in the URL
 * hash; the browser client (detectSessionInUrl, on by default) picks
 * them up automatically and turns them into a real session -- this
 * component just waits for that, then lets the invitee set a real
 * password with supabase.auth.updateUser(), which is what actually
 * finishes the invite (an unset-password invite session still works for
 * signing in again via the same link, but there's no password to type
 * next time without this step).
 */
export function AcceptInviteForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supabase is not configured.");
      setStatus("error");
      return;
    }

    function handleSession(session: Session | null) {
      setStatus((prev) => (prev === "checking" ? (session ? "ready" : "invalid") : prev));
    }

    supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus((prev) => (prev === "checking" ? "ready" : prev));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    setError("");
    try {
      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus("done");
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set your password.");
      setStatus("ready");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-axis-cream px-4">
      <div className="w-full max-w-sm rounded-card border border-axis-base/30 bg-white p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
        <h1 className="mt-1.5 font-head text-lg font-medium tracking-tight text-axis-core">
          Welcome to the Operations Hub
        </h1>

        {status === "checking" && <p className="mt-4 text-sm text-axis-core/55">Checking your invite link...</p>}

        {status === "invalid" && (
          <p className="mt-4 rounded-[8px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            This invite link is invalid or has expired. Ask whoever invited you to send a new one.
          </p>
        )}

        {status === "done" && <p className="mt-4 text-sm text-axis-core/55">Password set. Taking you to /admin...</p>}

        {(status === "ready" || status === "saving") && (
          <>
            <p className="mt-1.5 text-sm text-axis-core/60">Set a password to finish setting up your account.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Password</span>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Confirm password</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </label>

              {error && <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={status === "saving"}
                className="mt-2 inline-flex w-full items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "saving" ? "Saving..." : "Set password and sign in"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
