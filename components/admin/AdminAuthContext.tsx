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
