"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { getPublicNavItems, PublicSidebarFooter } from "@/components/layout/nav";
import { RequestCard } from "@/components/RequestCard";
import { RequestModal } from "@/components/RequestModal";
import { ClickUpSyncNotice } from "@/components/ClickUpSyncNotice";
import { REQUEST_TYPES, type RequestTypeSlug } from "@/lib/requestTypes";

export default function HomePage() {
  const [activeType, setActiveType] = useState<RequestTypeSlug | null>(null);

  const activeRequestType = REQUEST_TYPES.find((t) => t.slug === activeType);

  return (
    <PageShell navItems={getPublicNavItems()} footer={<PublicSidebarFooter />}>
      <header className="flex items-center justify-between border-b border-axis-base/30 bg-white px-10 py-4">
        <h1 className="font-head text-2xl font-bold tracking-tight text-axis-core">
          Operations Hub Center
        </h1>
        <Link
          href="/admin"
          className="rounded-[8px] border border-axis-base/50 bg-white px-4 py-2 text-sm font-semibold text-axis-core/70 transition-colors hover:border-axis-core hover:text-axis-core"
        >
          Admin
        </Link>
      </header>

      <section className="px-10 pb-10 pt-5">
        <p className="max-w-lg text-sm text-axis-core/55">
          Choose the process you need below to start a new request.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REQUEST_TYPES.map((type) => (
            <RequestCard key={type.slug} type={type} onOpen={setActiveType} />
          ))}
        </div>

        <ClickUpSyncNotice />
      </section>

      {activeRequestType && (
        <RequestModal
          requestType={activeRequestType}
          onClose={() => setActiveType(null)}
        />
      )}
    </PageShell>
  );
}
