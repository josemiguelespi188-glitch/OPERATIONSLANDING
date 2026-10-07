"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { CalendarMonthView } from "./CalendarMonthView";
import { QuickCreateModal } from "./QuickCreateModal";
import {
  SECTION_TYPE_LABELS,
  STATUS_LABELS,
  type CommunicationStatus,
  type CommunicationSummary,
} from "@/lib/communications/types";

const STATUS_BADGE: Record<CommunicationStatus, string> = {
  building: "bg-axis-light text-axis-core/60",
  pending_approval: "bg-axis-signal/40 text-axis-core",
  changes_requested: "bg-red-100 text-red-700",
  ready_for_launch: "bg-green-100 text-green-700",
  deployed: "bg-axis-core text-white",
};

function monthLabel(dateStr: string | null): string {
  if (!dateStr) return "No date set";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function CommunicationsCalendarList() {
  const adminFetch = useAdminFetch();
  const router = useRouter();
  const [items, setItems] = useState<CommunicationSummary[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [statusFilter, setStatusFilter] = useState<CommunicationStatus | "all">("all");
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/communications");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${body.error ?? "Failed to load communications."} (status ${res.status})`);
      setItems(body.communications);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communications.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(title: string, sendDate: string) {
    const res = await adminFetch("/api/admin/communications", {
      method: "POST",
      body: JSON.stringify({ title, sendDate: sendDate || null }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Could not create the communication.");
    router.push(`/admin/communications/${body.communication.id}`);
  }

  function openQuickCreate(dateKey: string | null) {
    setQuickCreateDate(dateKey);
    setShowQuickCreate(true);
  }

  const pendingApprovalCount = items?.filter((i) => i.status === "pending_approval").length ?? 0;

  const grouped = useMemo(() => {
    const filtered = (items ?? []).filter((i) => statusFilter === "all" || i.status === statusFilter);
    const byMonth = new Map<string, CommunicationSummary[]>();
    for (const item of filtered) {
      const key = monthLabel(item.sendDate);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(item);
    }
    return Array.from(byMonth.entries());
  }, [items, statusFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Operations Hub</p>
          <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">Communications</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[8px] border border-axis-base/50 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors ${view === "calendar" ? "bg-axis-core text-white" : "text-axis-core/60 hover:bg-axis-light"}`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-colors ${view === "list" ? "bg-axis-core text-white" : "text-axis-core/60 hover:bg-axis-light"}`}
            >
              List
            </button>
          </div>
          <button
            type="button"
            onClick={() => openQuickCreate(null)}
            aria-label="New communication"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-axis-core text-lg font-bold text-white hover:bg-axis-core/90"
          >
            +
          </button>
        </div>
      </div>

      {pendingApprovalCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setView("list");
            setStatusFilter("pending_approval");
          }}
          className="mt-5 flex w-full items-center justify-between gap-3 rounded-card border border-axis-signal/60 bg-axis-signal/15 px-5 py-3.5 text-left transition-colors hover:bg-axis-signal/25"
        >
          <span className="text-sm font-semibold text-axis-core">
            {pendingApprovalCount} communication{pendingApprovalCount === 1 ? "" : "s"} waiting for approval
          </span>
          <span className="text-xs font-medium text-axis-core/60">View →</span>
        </button>
      )}

      {error && <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {items === null && !error && <p className="mt-10 py-6 text-center text-sm text-axis-core/50">Loading...</p>}

      {items !== null && view === "calendar" && (
        <div className="mt-6">
          <CalendarMonthView
            monthDate={monthDate}
            items={items}
            onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            onToday={() => setMonthDate(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })}
            onDayClick={(dateKey) => openQuickCreate(dateKey)}
            onItemClick={(id) => router.push(`/admin/communications/${id}`)}
          />
        </div>
      )}

      {items !== null && view === "list" && (
        <>
          <div className="mt-6 flex items-center gap-2">
            <span className="text-xs font-medium text-axis-core/60">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CommunicationStatus | "all")}
              className="rounded-[8px] border border-axis-base/50 px-2.5 py-1.5 text-xs outline-none focus:border-axis-core"
            >
              <option value="all">All</option>
              {(Object.keys(STATUS_LABELS) as CommunicationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-6">
            {grouped.length === 0 && (
              <p className="py-6 text-center text-sm text-axis-core/50">
                No communications {statusFilter === "all" ? "yet" : `in "${STATUS_LABELS[statusFilter]}"`}.
              </p>
            )}
            {grouped.map(([month, monthItems]) => (
              <div key={month}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-axis-core/50">{month}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {monthItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/admin/communications/${item.id}`}
                      className="flex flex-col rounded-card border border-axis-base/30 bg-white p-4 shadow-card transition-colors hover:border-axis-core/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                        {item.sendDate && (
                          <span className="text-[11px] font-medium text-axis-core/45">
                            {new Date(`${item.sendDate}T00:00:00`).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-axis-core">{item.title}</p>
                      <p className="mt-1.5 text-xs text-axis-core/50">{SECTION_TYPE_LABELS[item.sectionType]}</p>
                      <span className="mt-4 inline-flex items-center justify-center rounded-[8px] border border-axis-base/50 py-2 text-xs font-semibold text-axis-core">
                        Open
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showQuickCreate && (
        <QuickCreateModal
          initialDate={quickCreateDate}
          onClose={() => setShowQuickCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
