"use client";

import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export interface AdminAuthValue {
  session: Session;
  signOut: () => void;
}

export const AdminAuthContext = createContext<AdminAuthValue | null>(null);

/** Access token + sign-out for the current admin session. Must be used inside app/admin's layout. */
export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within the /admin layout.");
  }
  return ctx;
}

/** fetch() with the admin session's bearer token attached, and a JSON body helper. */
export function useAdminFetch() {
  const { session } = useAdminAuth();

  return async function adminFetch(input: string, init: RequestInit = {}) {
    return fetch(input, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  };
}
