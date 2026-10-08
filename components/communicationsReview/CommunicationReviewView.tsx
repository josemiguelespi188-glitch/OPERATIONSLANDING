"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { STATUS_LABELS, type CommunicationComment, type CommunicationStatusHistoryEntry, type CommunicationSummary } from "@/lib/communications/types";

type Detail = CommunicationSummary & { history: CommunicationStatusHistoryEntry[]; comments: CommunicationComment[] };

type TimelineEntry =
  | { kind: "comment"; id: string; createdAt: string; author: string; body: string }
  | { kind: "status"; id: string; createdAt: string; author: string | null; fromStatus: CommunicationStatus | null; toStatus: CommunicationStatus; notes: string | null };

type CommunicationStatus = CommunicationSummary["status"];

const PRIMARY_BTN =
  "rounded-[8px] bg-axis-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-signal hover:text-axis-core disabled:opacity-40";
const SECONDARY_BTN =
  "rounded-[8px] border border-axis-base/50 px-5 py-2.5 text-sm font-semibold text-axis-core transition-colors hover:border-axis-signal hover:bg-axis-signal/25";

export function CommunicationReviewView({ token }: { token: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"approved" | "changes_requested" | null>(null);

  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/communications-review/${token}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load this communication.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this communication.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/communications-review/${token}/approve`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not approve this communication.");
      setOutcome("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this communication.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestChanges() {
    if (!changesComment.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/communications-review/${token}/request-changes`, {
        method: "POST",
        body: JSON.stringify({ comment: changesComment }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not send your requested changes.");
      setOutcome("changes_requested");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your requested changes.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePostComment() {
    const text = newCommentBody.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/communications-review/${token}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not post the comment.");
      setNewCommentBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the comment.");
    } finally {
      setPostingComment(false);
    }
  }

  if (notFound) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-card border border-axis-base/30 bg-white p-8 text-center">
          <p className="font-head text-lg font-bold text-axis-core">This review link is no longer valid.</p>
          <p className="mt-2 text-sm text-axis-core/60">
            It may have already been acted on, or a new approval request was sent out since.
          </p>
        </div>
      </Shell>
    );
  }

  if (outcome) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-card border border-axis-base/30 bg-white p-8 text-center">
          <p className="font-head text-lg font-bold text-axis-core">
            {outcome === "approved" ? "Approved — thank you." : "Changes requested — thank you."}
          </p>
          <p className="mt-2 text-sm text-axis-core/60">
            {outcome === "approved"
              ? "This communication is now ready to launch."
              : "Annelise will see your notes and resend it for approval once it's updated."}
          </p>
        </div>
      </Shell>
    );
  }

  if (!data && !error) {
    return (
      <Shell>
        <p className="text-center text-sm text-axis-core/50">Loading...</p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <p className="mx-auto max-w-md rounded-[8px] bg-red-50 px-4 py-3 text-center text-sm text-red-700">{error}</p>
      </Shell>
    );
  }

  const timeline: TimelineEntry[] = [
    ...data.comments.map((c): TimelineEntry => ({ kind: "comment", id: c.id, createdAt: c.createdAt, author: c.author, body: c.body })),
    ...data.history.map((h): TimelineEntry => ({
      kind: "status",
      id: h.id,
      createdAt: h.createdAt,
      author: h.changedBy,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      notes: h.notes,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  return (
    <Shell>
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Review this communication</p>
            <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">{data.title}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-axis-light px-3 py-1.5 text-xs font-semibold text-axis-core">
            {STATUS_LABELS[data.status]}
          </span>
        </div>

        {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 rounded-card border border-axis-base/30 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-axis-core/45">Email</p>
          {data.htmlCode?.trim() ? (
            <div className="mx-auto mt-3 w-full max-w-[640px]">
              <iframe srcDoc={data.htmlCode} sandbox="" title="Email preview" className="h-[560px] w-full rounded-[8px] border border-axis-base/50 bg-white" />
            </div>
          ) : (
            <p className="mt-3 text-sm text-axis-core/40">No HTML yet.</p>
          )}
        </div>

        <div className="mt-5 rounded-card border border-axis-base/30 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-axis-core/45">Comments</p>
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              rows={2}
              placeholder="Add a comment..."
              className="w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
            />
            <button type="button" onClick={handlePostComment} disabled={!newCommentBody.trim() || postingComment} className={`self-start ${SECONDARY_BTN}`}>
              {postingComment ? "Posting..." : "Post comment"}
            </button>
          </div>

          <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto">
            {timeline.length === 0 && <p className="text-xs text-axis-core/40">Nothing here yet.</p>}
            {timeline.map((entry) =>
              entry.kind === "comment" ? (
                <div key={`c-${entry.id}`} className="rounded-[8px] border border-axis-base/20 p-3">
                  <p className="text-xs font-semibold text-axis-core">{entry.author}</p>
                  <p className="mt-1 text-sm text-axis-core/80">{entry.body}</p>
                  <p className="mt-1 text-[11px] text-axis-core/40">{new Date(entry.createdAt).toLocaleString("en-US")}</p>
                </div>
              ) : (
                <div key={`s-${entry.id}`} className="border-l-2 border-axis-base/30 pl-3 text-xs text-axis-core/60">
                  <span className="font-medium text-axis-core">
                    {entry.fromStatus ? `${STATUS_LABELS[entry.fromStatus]} → ${STATUS_LABELS[entry.toStatus]}` : `Created as ${STATUS_LABELS[entry.toStatus]}`}
                  </span>
                  {" · "}
                  {entry.author} · {new Date(entry.createdAt).toLocaleString("en-US")}
                  {entry.notes && <p className="mt-1 text-axis-core/70">"{entry.notes}"</p>}
                </div>
              )
            )}
          </div>
        </div>

        <div className="mt-5 rounded-card border border-axis-base/30 bg-white p-5">
          {!showRequestChanges ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleApprove} disabled={busy} className={PRIMARY_BTN}>
                Approve
              </button>
              <button type="button" onClick={() => setShowRequestChanges(true)} disabled={busy} className={SECONDARY_BTN}>
                Request changes
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-axis-core">What needs to change?</p>
              <textarea
                value={changesComment}
                onChange={(e) => setChangesComment(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
                placeholder="Describe what needs to change before this is sent out..."
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={handleRequestChanges} disabled={busy || !changesComment.trim()} className={PRIMARY_BTN}>
                  Send
                </button>
                <button type="button" onClick={() => setShowRequestChanges(false)} className="rounded-[8px] px-4 py-2.5 text-sm font-semibold text-axis-core/60 hover:bg-axis-light">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-axis-cream">
      <header className="bg-axis-core px-6 py-5">
        <Logo variant="light" />
      </header>
      <main className="px-4 py-10 sm:px-8">{children}</main>
    </div>
  );
}
