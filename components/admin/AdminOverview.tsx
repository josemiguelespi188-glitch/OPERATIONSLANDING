"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { REQUEST_TYPES } from "@/lib/requestTypes";
import type { ClickUpSyncStatus, RequestStatus } from "@/lib/types";
import type { StatsRange } from "@/lib/utils/dateRange";
import { useAdminAuth } from "./AdminAuthContext";

interface AdminStats {
  total: number;
  byStatus: Record<RequestStatus, number>;
  bySyncStatus: Record<ClickUpSyncStatus, number>;
  byType: Record<string, number>;
  /** Slugs currently visible to investors -- "Requests by Type" below only shows these. */
  activeSlugs: string[];
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

interface InvestorFeedbackStats {
  total: number;
  averageRating: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
  recentComments: Array<{
    id: string;
    rating: number;
    comment: string;
    submittedAt: string;
  }>;
}

interface InvestorUpdateStats {
  total: number;
  byStatus: {
    submitted: number;
    in_progress: number;
    draft_created: number;
    pending_client_approval: number;
    approved: number;
    published: number;
    completed: number;
  };
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

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "30d", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
];

/** Recent Requests shows this many per page, with Prev/Next to page through the rest. */
const RECENT_PAGE_SIZE = 4;

export function AdminOverview() {
  const { session } = useAdminAuth();
  const [range, setRange] = useState<StatsRange>("30d");

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recentPage, setRecentPage] = useState(0);

  const [feedback, setFeedback] = useState<InvestorFeedbackStats | null>(null);
  const [feedbackError, setFeedbackError] = useState("");

  const [investorUpdates, setInvestorUpdates] = useState<InvestorUpdateStats | null>(null);
  const [investorUpdatesError, setInvestorUpdatesError] = useState("");

  const [scheduleLink, setScheduleLink] = useState("");
  const [scheduleLinkCopied, setScheduleLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [scheduleLinkError, setScheduleLinkError] = useState("");
  const [scheduleLinkModalOpen, setScheduleLinkModalOpen] = useState(false);

  const recentRef = useRef<HTMLDivElement>(null);
  const [scrollToRecentSignal, setScrollToRecentSignal] = useState(0);

  function handleReviewFailedSyncs() {
    setRecentPage(0);
    setScrollToRecentSignal((n) => n + 1);
  }

  useEffect(() => {
    if (scrollToRecentSignal === 0) return;
    recentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToRecentSignal]);

  // A range switch re-fetches a different "recent" list -- start back on
  // page 1 rather than possibly landing past the end of the new list.
  useEffect(() => {
    setRecentPage(0);
  }, [range]);

  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/stats?range=${range}`, { headers: authHeaders });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Failed to load admin stats:", res.status, body);
        throw new Error(`${body.error ?? "Failed to load admin stats."} (status ${res.status})`);
      }
      setStats(body);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin stats.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token, range]);

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/investor-feedback?range=${range}`, { headers: authHeaders });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Failed to load investor feedback:", res.status, body);
        throw new Error(`${body.error ?? "Failed to load investor feedback."} (status ${res.status})`);
      }
      setFeedback(body);
      setFeedbackError("");
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to load investor feedback.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token, range]);

  const fetchInvestorUpdates = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/investor-update-requests?range=${range}`, {
        headers: authHeaders,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Failed to load investor update requests:", res.status, body);
        throw new Error(
          `${body.error ?? "Failed to load investor update requests."} (status ${res.status})`
        );
      }
      setInvestorUpdates(body);
      setInvestorUpdatesError("");
    } catch (err) {
      setInvestorUpdatesError(
        err instanceof Error ? err.message : "Failed to load investor update requests."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.access_token, range]);

  useEffect(() => {
    setRefreshing(true);
    Promise.all([fetchStats(), fetchFeedback(), fetchInvestorUpdates()]).finally(() =>
      setRefreshing(false)
    );
  }, [fetchStats, fetchFeedback, fetchInvestorUpdates]);

  async function handleGenerateScheduleLink() {
    setGeneratingLink(true);
    setScheduleLinkError("");
    setScheduleLinkCopied(false);
    try {
      const res = await fetch("/api/admin/schedule-links", { method: "POST", headers: authHeaders });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not generate a link.");
      setScheduleLink(body.url);
      setScheduleLinkModalOpen(true);
    } catch (err) {
      setScheduleLinkError(err instanceof Error ? err.message : "Could not generate a link.");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleCopyScheduleLink() {
    try {
      await navigator.clipboard.writeText(scheduleLink);
      setScheduleLinkCopied(true);
    } catch {
      setScheduleLinkCopied(false);
    }
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      await fetch(`/api/requests/${id}/retry-sync`, { method: "POST", headers: authHeaders });
      await fetchStats();
    } finally {
      setRetryingId(null);
    }
  }

  /** Permanently deletes a request -- for cleaning up test submissions so
   *  they stop skewing the metrics above (Total Requests, by-status/by-
   *  sync-status breakdowns, Requests by Type all read straight off the
   *  `requests` table). Cannot be undone -- confirm first. */
  async function handleDelete(id: string, requestorName: string) {
    if (!confirm(`Delete "${requestorName}"'s request? This can't be undone and removes it from ClickUp sync history, but not from ClickUp itself.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Could not delete this request.");
        return;
      }
      await fetchStats();
    } finally {
      setDeletingId(null);
    }
  }

  const rangeLabel = range === "30d" ? "Last 30 Days" : "All Time";
  const failedSyncs = stats?.bySyncStatus.failed ?? 0;
  const recentPageCount = stats ? Math.max(1, Math.ceil(stats.recent.length / RECENT_PAGE_SIZE)) : 1;
  const recentPageRows = stats
    ? stats.recent.slice(recentPage * RECENT_PAGE_SIZE, recentPage * RECENT_PAGE_SIZE + RECENT_PAGE_SIZE)
    : [];

  // investor-update-request never lands in the generic `requests` table
  // (its own dedicated tables -- see the "Investor Update Requests"
  // section instead), and only an active (currently investor-visible)
  // type belongs in this at-a-glance list.
  const typeRows = stats
    ? REQUEST_TYPES.filter(
        (type) => type.slug !== "investor-update-request" && stats.activeSlugs.includes(type.slug)
      )
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
          <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
            Admin Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <span className="text-xs text-axis-core/40">Updating...</span>}
          <RangeToggle value={range} onChange={setRange} />
        </div>
      </div>

      {/* Permanently pinned at the top of the page, never collapsible --
          per explicit instruction, these actions have to always be
          visible without scrolling past other sections first. Two
          compact blocks side by side instead of one stretched full-width
          -- a single action here left most of the bar empty. */}
      <div className="mt-6 overflow-hidden rounded-card bg-axis-core text-white">
        <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Schedule a Call</p>
              <p className="mt-1 text-sm text-white/80">
                Generate a one-time booking link to share with a client.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateScheduleLink}
              disabled={generatingLink}
              className="shrink-0 rounded-[8px] bg-axis-signal px-5 py-2.5 text-sm font-semibold text-axis-core transition-colors hover:bg-white disabled:opacity-50"
            >
              {generatingLink ? "Generating..." : "Generate one-time link"}
            </button>
          </div>

          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Support Inquiry</p>
              <p className="mt-1 text-sm text-white/80">
                Open the investor support inquiry form -- it emails IR directly.
              </p>
            </div>
            <Link
              href="/support-inquiry"
              target="_blank"
              className="shrink-0 rounded-[8px] bg-axis-signal px-5 py-2.5 text-center text-sm font-semibold text-axis-core transition-colors hover:bg-white"
            >
              Open form
            </Link>
          </div>
        </div>
      </div>
      {scheduleLinkError && (
        <p className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">
          {scheduleLinkError}
        </p>
      )}

      <div className="mt-6">
        {loading && <p className="text-sm text-axis-core/50">Loading...</p>}
        {error && (
          <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {stats && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/40">
              {rangeLabel}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Total Requests" value={stats.total} tone="tan" />
              <KpiCard label="Submitted" value={stats.byStatus.submitted} />
              <KpiCard label="In Review" value={stats.byStatus.in_review} />
              <KpiCard label="Completed" value={stats.byStatus.completed} />
            </div>

            {/* Highest-priority item on the page: an actionable problem,
                not just a number, so it sits above every passive metric
                below it. */}
            {failedSyncs > 0 && (
              <div className="mt-4 flex flex-col gap-3 rounded-card border border-red-300 bg-red-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {failedSyncs} request{failedSyncs === 1 ? "" : "s"} failed to sync to ClickUp
                  </p>
                  <p className="mt-0.5 text-xs text-red-700/80">
                    These won&rsquo;t show up in ClickUp until retried.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReviewFailedSyncs}
                  className="shrink-0 rounded-[8px] bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800"
                >
                  Review and retry
                </button>
              </div>
            )}

            {/* Everything from here down always renders in full -- no
                section on this page collapses anymore. Compact cards and
                short lists keep it tight instead. */}
            <div ref={recentRef} className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-head text-sm font-medium tracking-tight text-axis-core">
                  Recent Requests
                </h2>
                <span className="text-xs text-axis-core/50">{stats.recent.length} total</span>
              </div>
              <div className="mt-2 overflow-hidden rounded-card border border-axis-base/30 bg-white">
                {recentPageRows.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-axis-core/50">
                    No requests {range === "30d" ? "in the last 30 days." : "yet."}
                  </p>
                )}
                {recentPageRows.map((req, i) => (
                  <div
                    key={req.id}
                    className={`px-4 py-2.5 text-sm ${i !== 0 ? "border-t border-axis-base/20" : ""}`}
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
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-axis-core/50">
                      <span className="truncate">
                        {req.clickup_task_id
                          ? `ClickUp Task: ${req.clickup_task_id}`
                          : req.clickup_sync_error || "Not synced to ClickUp yet."}
                        {req.clickup_status_text && ` · ClickUp status: ${req.clickup_status_text}`}
                        {" · "}
                        {new Date(req.created_at).toLocaleString()}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRetry(req.id)}
                          disabled={retryingId === req.id}
                          className="rounded-[6px] border border-axis-base/50 px-2 py-1 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-50"
                        >
                          {retryingId === req.id ? "Resending..." : "Resend to ClickUp"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(req.id, req.requestor_name)}
                          disabled={deletingId === req.id}
                          className="rounded-[6px] border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:border-red-700 disabled:opacity-50"
                        >
                          {deletingId === req.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
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
              {recentPageCount > 1 && (
                <div className="mt-2 flex items-center justify-end gap-2">
                  <span className="text-xs text-axis-core/50">
                    Page {recentPage + 1} of {recentPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
                    disabled={recentPage === 0}
                    className="rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentPage((p) => Math.min(recentPageCount - 1, p + 1))}
                    disabled={recentPage >= recentPageCount - 1}
                    className="rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* ClickUp Sync Health, Investor Experience Rating, and
                Requests by Type share one row -- each one's own card is
                small, so stacking them full-width wasted most of the
                screen's horizontal space. */}
            <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <CompactCard title="ClickUp Sync Health">
                <div className="space-y-1.5">
                  <MiniStat label="Synced" value={stats.bySyncStatus.synced} />
                  <MiniStat label="Failed" value={stats.bySyncStatus.failed} tone={failedSyncs > 0 ? "alert" : undefined} />
                  <MiniStat label="Pending" value={stats.bySyncStatus.pending} />
                </div>
              </CompactCard>

              <CompactCard title="Investor Experience Rating">
                {feedback && feedback.total > 0 ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-axis-core">
                      {Math.round(feedback.averageRating * 10) / 10}
                    </span>
                    <span className="text-axis-signal">★</span>
                    <span className="text-xs text-axis-core/50">
                      {feedback.total} rating{feedback.total === 1 ? "" : "s"}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-axis-core/50">
                    {feedbackError ? feedbackError : "No ratings yet"}
                  </p>
                )}
              </CompactCard>

              {typeRows.length > 0 ? (
                <CompactCard title="Requests by Type">
                  <div className="space-y-1.5">
                    {typeRows.map((type) => (
                      <div key={type.slug} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-axis-core/70">{type.name}</span>
                        <span className="shrink-0 font-semibold text-axis-core">
                          {stats.byType[type.slug] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </CompactCard>
              ) : (
                <CompactCard title="Requests by Type">
                  <p className="text-sm text-axis-core/50">No requests yet</p>
                </CompactCard>
              )}
            </div>
          </>
        )}

        {investorUpdatesError && (
          <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">
            {investorUpdatesError}
          </p>
        )}

        {investorUpdates && (
          <div className="mt-4 rounded-card border border-axis-base/30 bg-white px-4 py-3.5">
            <h2 className="font-head text-sm font-medium tracking-tight text-axis-core">
              Investor Update Requests
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KpiCard label="Investor Update Requests" value={investorUpdates.total} tone="tan" />
              <KpiCard label="Pending Investor Updates" value={investorUpdates.byStatus.submitted} />
              <KpiCard label="Updates In Progress" value={investorUpdates.byStatus.in_progress} />
              <KpiCard
                label="Updates Awaiting Approval"
                value={investorUpdates.byStatus.pending_client_approval}
              />
              <KpiCard label="Completed Updates" value={investorUpdates.byStatus.completed} accent />
            </div>
          </div>
        )}
      </div>

      {scheduleLinkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-axis-core/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setScheduleLinkModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-card bg-white p-5 shadow-modal">
            <p className="text-sm font-semibold text-axis-core">One-time scheduling link</p>
            <p className="mt-1 text-xs text-axis-core/55">
              Share this with one client. It stops working the moment they book a call through it.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={scheduleLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 truncate rounded-[6px] border border-axis-base/40 bg-axis-light px-3 py-2 text-sm text-axis-core/80"
              />
              <button
                type="button"
                onClick={handleCopyScheduleLink}
                className="shrink-0 rounded-[6px] border border-axis-base/50 px-3 py-2 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core"
              >
                {scheduleLinkCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setScheduleLinkModalOpen(false)}
                className="rounded-[8px] px-4 py-2 text-sm font-medium text-axis-core/60 transition-colors hover:bg-axis-signal/25 hover:text-axis-core"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RangeToggle({
  value,
  onChange,
}: {
  value: StatsRange;
  onChange: (range: StatsRange) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-axis-base/40 bg-white p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.value
              ? "bg-axis-core text-white"
              : "text-axis-core/60 hover:text-axis-core"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** A small always-visible card for the 3-up row (ClickUp Sync Health, Investor Experience Rating, Requests by Type). */
function CompactCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-axis-base/30 bg-white px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "alert" }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-axis-core/70">{label}</span>
      <span className={`font-semibold ${tone === "alert" && value > 0 ? "text-red-700" : "text-axis-core"}`}>
        {value}
      </span>
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
