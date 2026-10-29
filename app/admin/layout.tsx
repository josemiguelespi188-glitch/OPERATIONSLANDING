"use client";

import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { RequireAdminSession } from "@/components/auth/RequireAdminSession";
import { PageShell } from "@/components/layout/PageShell";
import { getAdminNavItems } from "@/components/layout/nav";
import { LogoutIcon } from "@/components/layout/icons";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdminSession>
      <AdminShell>{children}</AdminShell>
    </RequireAdminSession>
  );
}

/** The sidebar/chrome wrapper, split out from the login gate (RequireAdminSession) so /support-inquiry can reuse the gate without this chrome. */
function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAdminAuth();
  const pathname = usePathname();

  const active = pathname?.startsWith("/admin/forms")
    ? "forms"
    : pathname?.startsWith("/admin/pdf-generator")
      ? "pdf-generator"
      : pathname?.startsWith("/admin/sa-review")
        ? "sa-review"
        : pathname?.startsWith("/admin/communications")
          ? "communications"
          : pathname?.startsWith("/admin/orders")
            ? "orders"
            : pathname?.startsWith("/admin/team")
              ? "team"
              : "overview";
  const initial = session.user.email?.[0]?.toUpperCase() ?? "A";

  return (
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
      <div className="mx-auto max-w-6xl px-10 py-10 xl:max-w-[1400px] 2xl:max-w-[1800px]">{children}</div>
    </PageShell>
  );
}
