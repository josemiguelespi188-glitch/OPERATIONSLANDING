import { GridIcon, LayersIcon } from "./icons";
import type { SidebarNavItem } from "./Sidebar";

/** The public site currently has one real destination — the request
 *  catalog — so every page (the home grid and each individual request
 *  form) highlights it as active. */
export function getPublicNavItems(): SidebarNavItem[] {
  return [{ label: "Request Center", href: "/", icon: GridIcon, active: true }];
}

/** Small caption block filling the sidebar footer on public pages —
 *  no account/session exists there (that's admin-only), so this is just
 *  a static label rather than a real account block. */
export function PublicSidebarFooter() {
  return (
    <div className="px-2 py-1">
      <p className="text-xs font-semibold text-white/70">AxisKey Operations Hub</p>
      <p className="mt-0.5 text-xs text-white/40">Internal Request Center</p>
    </div>
  );
}

export function getAdminNavItems(active: "overview" | "forms"): SidebarNavItem[] {
  return [
    { label: "Overview", href: "/admin", icon: GridIcon, active: active === "overview" },
    { label: "Form Builder", href: "/admin/forms", icon: LayersIcon, active: active === "forms" },
  ];
}
