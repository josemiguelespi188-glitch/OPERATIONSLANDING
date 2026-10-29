"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SupportInquiryListItem {
  id: string;
  investorName: string;
  investorEmail: string;
  subject: string;
  submittedAt: string;
  zendeskTicketId: number | null;
  zendeskStatus: string | null;
  statusPageUrl: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  open: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  hold: "bg-axis-base/40 text-axis-core/70",
  solved: "bg-green-100 text-green-700",
  closed: "bg-axis-base/40 text-axis-core/50",
};

const POLL_INTERVAL_MS = 20_000;

/**
 * "Previous tickets" panel next to the Support Inquiry form -- lists
 * every inquiry ever submitted through this tool (all coworkers share
 * one list today, since /support-inquiry has no login yet -- see
 * supabase/migrations/026_support_inquiries.sql) with its live Zendesk
 * status and a link to the hosted status page Zendesk's "Status Token"
 * field points at. Fetches GET /api/support-inquiry/list, which does its
 * own best-effort resolution/refresh against Zendesk on every call.
 *
 * Polls while at least one row still has no zendeskTicketId (the
 * email-to-ticket automation hasn't produced a match yet) -- stops once
 * every row is resolved, or on unmount, so this doesn't poll forever
 * once there's nothing left pending.
 */
export function PreviousTicketsPanel({ refreshSignal }: { refreshSignal: number }) {
  const [inquiries, setInquiries] = useState<SupportInquiryListItem[] | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/support-inquiry/list");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load previous tickets.");
      setInquiries(body.inquiries ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load previous tickets.");
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  useEffect(() => {
    const hasPending = inquiries?.some((item) => !item.zendeskTicketId) ?? false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hasPending) {
      intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [inquiries, load]);

  return (
    <div className="w-full max-w-[380px]">
      <h2 className="font-head text-[17px] font-medium tracking-tight text-axis-core">Previous tickets</h2>
      <p className="mt-1 text-xs leading-relaxed text-axis-core/50">
        Everything submitted from this tool, with its live Zendesk status.
      </p>

      <div className="mt-4 space-y-2.5">
        {error && <p className="rounded-[6px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {inquiries === null && !error && <p className="text-sm text-axis-core/40">Loading...</p>}

        {inquiries !== null && inquiries.length === 0 && (
          <p className="text-sm text-axis-core/40">No inquiries submitted yet.</p>
        )}

        {inquiries?.map((item) => (
          <div key={item.id} className="rounded-[10px] border border-axis-base/30 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-axis-core">{item.subject}</p>
              {item.zendeskStatus ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    STATUS_BADGE[item.zendeskStatus] ?? "bg-axis-base/40 text-axis-core/60"
                  }`}
                >
                  {item.zendeskStatus}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-axis-base/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-axis-core/50">
                  Pending
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-axis-core/55">
              {item.investorName} &middot; {item.investorEmail}
            </p>
            <p className="mt-0.5 text-[11px] text-axis-core/35">{formatDate(item.submittedAt)}</p>

            {item.statusPageUrl ? (
              <a
                href={item.statusPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-axis-core underline decoration-dotted hover:text-axis-core/70"
              >
                View ticket status &rarr;
              </a>
            ) : (
              <p className="mt-2 text-xs text-axis-core/35">
                {item.zendeskTicketId ? "Status link not available yet." : "Waiting for the ticket to be created..."}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
