"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import {
  CHANNEL_LABELS,
  SECTION_TYPE_LABELS,
  STATUS_LABELS,
  type CommunicationSectionType,
  type CommunicationStatus,
  type CommunicationSummary,
} from "@/lib/communications/types";

const STATUS_BADGE: Record<CommunicationStatus, string> = {
  idea: "bg-axis-light text-axis-core/60",
  in_design: "bg-axis-base/30 text-axis-core",
  sent_for_approval: "bg-axis-signal/40 text-axis-core",
  changes_requested: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
  scheduled: "bg-axis-core text-white",
  sent: "bg-axis-core/70 text-white",
};

const SECTION_TYPES: CommunicationSectionType[] = [
  "section_1",
  "section_2",
  "faq_of_month",
  "full_communication",
];

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
  const [statusFilter, setStatusFilter] = useState<CommunicationStatus | "all">("all");

  const [title, setTitle] = useState("");
  const [sectionType, setSectionType] = useState<CommunicationSectionType>("section_1");
  const [sendDate, setSendDate] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/communications", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), sectionType, sendDate: sendDate || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create the communication.");
      router.push(`/admin/communications/${body.communication.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the communication.");
      setCreating(false);
    }
  }

  const pendingApprovalCount = items?.filter((i) => i.status === "sent_for_approval").length ?? 0;

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
      <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Operations Hub</p>
      <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">Communications</h1>
      <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
        Plan, design, and approve investor communications before they go out — one place for Mike, Annelise,
        Diego, and Lana to see what is going out, when, and in what state.
      </p>

      {pendingApprovalCount > 0 && (
        <button
          type="button"
          onClick={() => setStatusFilter("sent_for_approval")}
          className="mt-6 flex w-full items-center justify-between gap-3 rounded-card border border-axis-signal/60 bg-axis-signal/15 px-5 py-3.5 text-left transition-colors hover:bg-axis-signal/25"
        >
          <span className="text-sm font-semibold text-axis-core">
            {pendingApprovalCount} communication{pendingApprovalCount === 1 ? "" : "s"} waiting for approval
          </span>
          <span className="text-xs font-medium text-axis-core/60">View →</span>
        </button>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-6 rounded-card border border-axis-base/30 bg-white p-5 shadow-card"
      >
        <p className="text-sm font-semibold text-axis-core">New communication</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-medium text-axis-core/70">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Nov 2026 – How we protect your investment"'
              required
              className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-axis-core/70">Section type</span>
            <select
              value={sectionType}
              onChange={(e) => setSectionType(e.target.value as CommunicationSectionType)}
              className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
            >
              {SECTION_TYPES.map((s) => (
                <option key={s} value={s}>
                  {SECTION_TYPE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-axis-core/70">Send date</span>
            <input
              type="date"
              value={sendDate}
              onChange={(e) => setSendDate(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
            />
          </label>
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-40"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      {error && <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
        {items === null && !error && <p className="py-6 text-center text-sm text-axis-core/50">Loading...</p>}
        {items !== null && grouped.length === 0 && (
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
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[item.status]}`}
                    >
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
                  <p className="mt-1.5 text-xs text-axis-core/50">
                    {SECTION_TYPE_LABELS[item.sectionType]} · {CHANNEL_LABELS[item.channel]}
                  </p>
                  <span className="mt-4 inline-flex items-center justify-center rounded-[8px] border border-axis-base/50 py-2 text-xs font-semibold text-axis-core transition-colors group-hover:bg-axis-light">
                    Open
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
