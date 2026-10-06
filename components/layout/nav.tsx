import { FileIcon, GridIcon, LayersIcon } from "./icons";
import type { SidebarNavItem } from "./Sidebar";

// The public site (home + each request form) is a single screen with no
// sidebar — see PageShell usage only in app/admin/layout.tsx now.

export type AdminNavKey = "overview" | "forms" | "pdf-generator";

export function getAdminNavItems(active: AdminNavKey): SidebarNavItem[] {
  return [
    { label: "Overview", href: "/admin", icon: GridIcon, active: active === "overview" },
    { label: "Form Builder", href: "/admin/forms", icon: LayersIcon, active: active === "forms" },
    { label: "PDF Generator", href: "/admin/pdf-generator", icon: FileIcon, active: active === "pdf-generator" },
  ];
}
