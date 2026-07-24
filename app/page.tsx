"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { RequestCard } from "@/components/RequestCard";
import { RequestModal } from "@/components/RequestModal";
import { AdminPanel } from "@/components/AdminPanel";
import { REQUEST_TYPES, type RequestTypeSlug } from "@/lib/requestTypes";

export default function HomePage() {
  const [activeType, setActiveType] = useState<RequestTypeSlug | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const activeRequestType = REQUEST_TYPES.find((t) => t.slug === activeType);

  return (
    <main className="min-h-screen">
      <header className="border-b border-axis-base/30 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo />
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="rounded-[8px] border border-axis-base/50 px-4 py-2 text-sm font-semibold text-axis-core/70 transition-colors hover:border-axis-core hover:text-axis-core"
          >
            Admin
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-14">
        <div className="mb-12">
          <h1 className="font-head text-2xl font-medium tracking-tight text-axis-core sm:text-3xl">
            Axis Operations Hub
          </h1>
          <p className="mt-2 text-sm text-axis-core/55">
            Internal Request Center
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REQUEST_TYPES.map((type) => (
            <RequestCard key={type.slug} type={type} onOpen={setActiveType} />
          ))}
        </div>
      </section>

      {activeRequestType && (
        <RequestModal
          requestType={activeRequestType}
          onClose={() => setActiveType(null)}
        />
      )}

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </main>
  );
}
