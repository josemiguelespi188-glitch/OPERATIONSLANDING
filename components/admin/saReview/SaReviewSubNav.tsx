"use client";

import Link from "next/link";

const TABS = [
  { label: "Reviews", href: "/admin/sa-review", key: "reviews" },
  { label: "Format Templates", href: "/admin/sa-review/templates", key: "templates" },
  { label: "Knowledge Base", href: "/admin/sa-review/knowledge", key: "knowledge" },
] as const;

export function SaReviewSubNav({ active }: { active: "reviews" | "templates" | "knowledge" }) {
  return (
    <div className="mb-6 flex gap-1 border-b border-axis-base/30">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
            active === tab.key
              ? "border-axis-core text-axis-core"
              : "border-transparent text-axis-core/50 hover:text-axis-core"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
