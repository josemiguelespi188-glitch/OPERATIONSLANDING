import Link from "next/link";
import { Logo } from "@/components/Logo";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}

/**
 * Persistent dark sidebar shell — mirrors the AxisKey investor portal's
 * layout (logo, nav list, optional footer block for account/help info).
 * Presentational only: which item is "active" is decided by the caller
 * (see components/layout/nav.tsx) rather than read from the URL here, so
 * this stays a plain component usable from both server and client pages.
 */
export function Sidebar({
  navItems,
  footer,
}: {
  navItems: SidebarNavItem[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-axis-core">
      <div className="px-6 py-7">
        <Link href="/">
          <Logo variant="light" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors ${
              item.active
                ? "bg-axis-base/20 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white/85"
            }`}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      {footer && <div className="border-t border-white/10 px-4 py-4">{footer}</div>}
    </aside>
  );
}
