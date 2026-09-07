"use client";

import { useCallback, useEffect, useState } from "react";
import { REQUEST_TYPES } from "@/lib/requestTypes";
import type { ClickUpSyncStatus, RequestStatus } from "@/lib/types";
import { ClickUpSyncNotice } from "@/components/ClickUpSyncNotice";
import { useAdminAuth } from "./AdminAuthContext";

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
    clickup_status_text: string | null;
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

export function AdminOverview() {
  const { session } = useAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { headers: authHeaders });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Failed to load admin stats:", res.status, body);
        throw new Error(`${body.error ?? "Failed to load admin stats."} (status ${res.status})`);
      }
      setStats(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin stats.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      await fetch(`/api/requests/${id}/retry-sync`, { method: "POST", headers: authHeaders });
      await fetchStats();
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
      <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
        Admin Overview
      </h1>

      <div className="mt-8">
        {loading && <p className="text-sm text-axis-core/50">Loading...</p>}
        {error && (
          <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Total Requests" value={stats.total} tone="tan" />
              <KpiCard label="Submitted" value={stats.byStatus.submitted} />
              <KpiCard label="In Review" value={stats.byStatus.in_review} />
              <KpiCard label="Completed" value={stats.byStatus.completed} />
            </div>

            <div className="mt-8">
              <h3 className="font-head text-sm font-medium tracking-tight text-axis-core">
                ClickUp Sync
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <KpiCard label="Successful Syncs" value={stats.bySyncStatus.synced} accent />
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
                      <span className="w-40 shrink-0 text-sm text-axis-core/70">{type.name}</span>
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
              <div className="mt-3 overflow-hidden rounded-card border border-axis-base/30 bg-white">
                {stats.recent.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-axis-core/50">
                    No requests yet.
                  </p>
                )}
                {stats.recent.map((req, i) => (
                  <div
                    key={req.id}
                    className={`px-4 py-3 text-sm ${i !== 0 ? "border-t border-axis-base/20" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-axis-core">{req.requestor_name}</p>
                        <p className="truncate text-axis-core/50">
                          {REQUEST_TYPES.find((t) => t.slug === req.request_type_slug)?.name ??
                            req.request_type_slug}
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
                        {req.clickup_status_text && ` · ClickUp status: ${req.clickup_status_text}`}
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
                    {/* A "synced" row can still carry a best-effort warning (an
                        attachment that didn't link to its field, a rejected
                        custom field) — syncRequestAndPersist() stores that in
                        clickup_sync_error even though the task itself was
                        created. The line above only ever shows the task id in
                        that case, so without this it silently disappears. */}
                    {req.clickup_task_id && req.clickup_sync_error && (
                      <p className="mt-1 break-words text-xs text-red-700">{req.clickup_sync_error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <ClickUpSyncNotice />
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: number;
  accent?: boolean;
  tone?: "tan";
}) {
  const styles = accent
    ? "border-axis-signal/60 bg-axis-signal/20"
    : tone === "tan"
      ? "border-axis-base/50 bg-axis-base"
      : "border-axis-base/30 bg-white";

  return (
    <div className={`rounded-card border px-4 py-3 ${styles}`}>
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
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
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
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {SYNC_LABEL[status]}
    </span>
  );
}
