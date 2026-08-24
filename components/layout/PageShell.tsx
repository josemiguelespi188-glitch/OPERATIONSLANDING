import { Sidebar, type SidebarNavItem } from "./Sidebar";

/**
 * Shared app chrome: dark sidebar + a warm cream content area, used by
 * both the public request pages and the admin section so the whole
 * platform reads as one system. Content keeps its own max-width/padding —
 * this only owns the sidebar split and the page background.
 */
export function PageShell({
  navItems,
  footer,
  children,
}: {
  navItems: SidebarNavItem[];
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-axis-cream">
      <Sidebar navItems={navItems} footer={footer} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
