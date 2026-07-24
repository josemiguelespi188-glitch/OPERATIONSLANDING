"use client";

import { useCallback, useEffect, useState } from "react";
import { REQUEST_TYPES } from "@/lib/requestTypes";
import type { ClickUpSyncStatus, RequestStatus } from "@/lib/types";

interface AdminStats {
  total: number;
  byStatus: Record<RequestStatus, number>;
  bySyncStatus: Record<ClickUpSyncStatus, number>;
  byType: Record<string, number>;
  recent: Array<{
    id: string;
    request_type_slug: string;
    requestor_name: string;
    investor_name: string | null;
    deal_name: string | null;
    status: RequestStatus;
    clickup_task_id: string | null;
    clickup_sync_status: ClickUpSyncStatus;
    clickup_sync_error: string | null;
    created_at: string;
  }>;
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "Submitted",
  in_review: "In Review",
  completed: "Completed",
};

const SYNC_LABEL: Record<ClickUpSyncStatus, string> = {
  pending: "Pending Sync",
  synced: "Synced",
  failed: "Failed",
};

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to load admin stats.");
      setStats(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      await fetch(`/api/requests/${id}/retry-sync`, { method: "POST" });
      await fetchStats();
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-axis-core/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-axis-base/30 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">
              Internal
            </p>
            <h2 className="mt-1 font-head text-lg font-medium tracking-tight text-axis-core">
              Admin Overview
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[6px] p-1.5 text-axis-core/50 transition-colors hover:bg-axis-light hover:text-axis-core"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 4L14 14M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {loading && <p className="text-sm text-axis-core/50">Loading...</p>}
          {error && (
            <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {stats && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="Total Requests" value={stats.total} />
                <KpiCard label="Submitted" value={stats.byStatus.submitted} />
                <KpiCard label="In Review" value={stats.byStatus.in_review} />
                <KpiCard label="Completed" value={stats.byStatus.completed} />
              </div>

              <div className="mt-8">
                <h3 className="font-head text-sm font-medium tracking-tight text-axis-core">
                  ClickUp Sync
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <KpiCard
                    label="Successful Syncs"
                    value={stats.bySyncStatus.synced}
                    accent
                  />
                  <KpiCard label="Failed Syncs" value={stats.bySyncStatus.failed} />
                  <KpiCard label="Pending Sync" value={stats.bySyncStatus.pending} />
                </div>
              </div>

              <div className="mt-8">
                <h3 className="font-head text-sm font-medium tracking-tight text-axis-core">
                  Requests by Type
                </h3>
                <div className="mt-3 space-y-2">
                  {REQUEST_TYPES.map((type) => {
                    const count = stats.byType[type.slug] ?? 0;
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={type.slug} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 text-sm text-axis-core/70">
                          {type.name}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-axis-light">
                          <div
                            className="h-full rounded-full bg-axis-signal"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right text-sm font-semibold text-axis-core">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8">
                <h3 className="font-head text-sm font-medium tracking-tight text-axis-core">
                  Recent Requests
                </h3>
                <div className="mt-3 overflow-hidden rounded-card border border-axis-base/30">
                  {stats.recent.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-axis-core/50">
                      No requests yet.
                    </p>
                  )}
                  {stats.recent.map((req, i) => (
                    <div
                      key={req.id}
                      className={`px-4 py-3 text-sm ${
                        i !== 0 ? "border-t border-axis-base/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-axis-core">
                            {req.requestor_name}
                          </p>
                          <p className="truncate text-axis-core/50">
                            {REQUEST_TYPES.find(
                              (t) => t.slug === req.request_type_slug
                            )?.name ?? req.request_type_slug}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={req.status} />
                          <SyncBadge status={req.clickup_sync_status} />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-axis-core/50">
                        <span className="truncate">
                          {req.clickup_task_id
                            ? `ClickUp Task: ${req.clickup_task_id}`
                            : req.clickup_sync_error || "Not synced to ClickUp yet."}
                          {" · "}
                          {new Date(req.created_at).toLocaleString()}
                        </span>
                        {req.clickup_sync_status !== "synced" && (
                          <button
                            type="button"
                            onClick={() => handleRetry(req.id)}
                            disabled={retryingId === req.id}
                            className="shrink-0 rounded-[6px] border border-axis-base/50 px-2 py-1 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-50"
                          >
                            {retryingId === req.id ? "Retrying..." : "Retry"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-card border px-4 py-3 ${
        accent
          ? "border-axis-signal/60 bg-axis-signal/20"
          : "border-axis-base/30 bg-axis-light"
      }`}
    >
      <p className="text-2xl font-bold text-axis-core">{value}</p>
      <p className="mt-0.5 text-xs text-axis-core/55">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const styles: Record<RequestStatus, string> = {
    submitted: "bg-axis-light text-axis-core/70",
    in_review: "bg-axis-base/40 text-axis-core",
    completed: "bg-axis-signal text-axis-core",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function SyncBadge({ status }: { status: ClickUpSyncStatus }) {
  const styles: Record<ClickUpSyncStatus, string> = {
    pending: "bg-axis-base/40 text-axis-core",
    synced: "bg-axis-signal text-axis-core",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {SYNC_LABEL[status]}
    </span>
  );
}
