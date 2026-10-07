"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import {
  SECTION_TYPE_LABELS,
  STATUS_LABELS,
  type CommunicationSectionType,
  type CommunicationStatus,
  type CommunicationStatusHistoryEntry,
  type CommunicationSummary,
} from "@/lib/communications/types";

type Detail = CommunicationSummary & { history: CommunicationStatusHistoryEntry[] };

const SECTION_TYPES: CommunicationSectionType[] = [
  "section_1",
  "section_2",
  "faq_of_month",
  "full_communication",
];

function fieldClass() {
  return "mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core";
}

export function CommunicationDetail({ id }: { id: string }) {
  const adminFetch = useAdminFetch();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [sectionType, setSectionType] = useState<CommunicationSectionType>("section_1");
  const [sendDate, setSendDate] = useState("");
  const [faqNotes, setFaqNotes] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [htmlTab, setHtmlTab] = useState<"visual" | "code">("visual");

  const [approverChoice, setApproverChoice] = useState("Diego");
  const [showApprove, setShowApprove] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/communications/${id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load this communication.");
      setData(body);
      setTitle(body.title);
      setSectionType(body.sectionType);
      setSendDate(body.sendDate ?? "");
      setFaqNotes(body.faqNotes ?? "");
      setHtmlCode(body.htmlCode ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this communication.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/communications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          sectionType,
          sendDate: sendDate || null,
          faqNotes,
          htmlCode,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: CommunicationStatus, extra?: Record<string, unknown>) {
    setStatusBusy(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/communications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, htmlCode, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update the status.");
      setShowApprove(false);
      setShowRequestChanges(false);
      setChangesComment("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${data?.title}"? This cannot be undone.`)) return;
    try {
      const res = await adminFetch(`/api/admin/communications/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete.");
      }
      router.push("/admin/communications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  if (!data && !error) return <p className="py-10 text-center text-sm text-axis-core/50">Loading...</p>;
  if (!data) {
    return <p className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  const canSendForApproval = !!htmlCode.trim();

  return (
    <div>
      <Link href="/admin/communications" className="text-xs font-medium text-axis-core/50 hover:text-axis-core">
        ← Communications
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled communication"
          className="min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent font-head text-2xl font-medium tracking-tight text-axis-core outline-none transition-colors hover:border-axis-base/40 focus:border-axis-core"
        />
        <span className="mt-1 shrink-0 rounded-full bg-axis-light px-3 py-1.5 text-xs font-semibold text-axis-core">
          {STATUS_LABELS[data.status]}
        </span>
      </div>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: the email itself */}
        <div className="rounded-card border border-axis-base/30 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-axis-core">Email</p>
            <div className="flex rounded-[8px] border border-axis-base/50 p-0.5">
              <button
                type="button"
                onClick={() => setHtmlTab("visual")}
                className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-colors ${htmlTab === "visual" ? "bg-axis-core text-white" : "text-axis-core/60 hover:bg-axis-light"}`}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setHtmlTab("code")}
                className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-colors ${htmlTab === "code" ? "bg-axis-core text-white" : "text-axis-core/60 hover:bg-axis-light"}`}
              >
                HTML
              </button>
            </div>
          </div>

          {htmlTab === "visual" ? (
            htmlCode.trim() ? (
              <iframe
                srcDoc={htmlCode}
                sandbox=""
                title="Email preview"
                className="mt-3 h-[600px] w-full rounded-[8px] border border-axis-base/50 bg-white"
              />
            ) : (
              <div className="mt-3 flex h-[600px] items-center justify-center rounded-[8px] border border-dashed border-axis-base/50 text-sm text-axis-core/40">
                No HTML yet — switch to the HTML tab to paste it in.
              </div>
            )
          ) : (
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              spellCheck={false}
              placeholder="Paste the email's HTML code here..."
              className="mt-3 h-[600px] w-full rounded-[8px] border border-axis-base/50 bg-axis-light/30 p-3 font-mono text-xs leading-relaxed text-axis-core outline-none focus:border-axis-core"
            />
          )}
        </div>

        {/* Right: functions */}
        <div className="flex flex-col gap-5">
          <div className="rounded-card border border-axis-base/30 bg-white p-5">
            <p className="text-sm font-semibold text-axis-core">Status</p>

            {data.status === "building" && (
              <div className="mt-3">
                <button
                  type="button"
                  disabled={statusBusy || !canSendForApproval}
                  onClick={() => setStatus("pending_approval")}
                  className="w-full rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
                >
                  Send for approval
                </button>
                {!canSendForApproval && (
                  <p className="mt-2 text-xs text-axis-core/50">Add the HTML before sending for approval.</p>
                )}
              </div>
            )}

            {data.status === "pending_approval" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowApprove(true)}
                  className="rounded-[8px] bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestChanges(true)}
                  className="rounded-[8px] border border-axis-base/50 px-4 py-2 text-xs font-semibold text-axis-core hover:bg-axis-light"
                >
                  Request changes
                </button>
              </div>
            )}

            {showApprove && (
              <div className="mt-3 rounded-[8px] border border-axis-base/40 bg-axis-light/50 p-4">
                <p className="text-xs font-semibold text-axis-core">Who is approving?</p>
                <div className="mt-2 flex gap-3">
                  {["Diego", "Lana"].map((name) => (
                    <label key={name} className="flex items-center gap-1.5 text-sm text-axis-core">
                      <input
                        type="radio"
                        name="approver"
                        checked={approverChoice === name}
                        onChange={() => setApproverChoice(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => setStatus("ready_for_launch", { approvedBy: approverChoice })}
                    className="rounded-[8px] bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40"
                  >
                    Confirm approval
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApprove(false)}
                    className="rounded-[8px] px-4 py-2 text-xs font-semibold text-axis-core/60 hover:bg-axis-light"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showRequestChanges && (
              <div className="mt-3 rounded-[8px] border border-axis-base/40 bg-axis-light/50 p-4">
                <p className="text-xs font-semibold text-axis-core">What needs to change?</p>
                <textarea
                  value={changesComment}
                  onChange={(e) => setChangesComment(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
                  placeholder="Describe what Annelise should fix before resending..."
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={statusBusy || !changesComment.trim()}
                    onClick={() => setStatus("changes_requested", { comment: changesComment })}
                    className="rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequestChanges(false)}
                    className="rounded-[8px] px-4 py-2 text-xs font-semibold text-axis-core/60 hover:bg-axis-light"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {data.status === "changes_requested" && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => setStatus("building")}
                className="mt-3 w-full rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
              >
                Back to Building (edit and resend)
              </button>
            )}

            {data.status === "ready_for_launch" && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => setStatus("deployed")}
                className="mt-3 w-full rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
              >
                Mark as Deployed
              </button>
            )}

            {data.status === "deployed" && (
              <p className="mt-3 text-xs text-axis-core/50">This communication has been deployed.</p>
            )}

            {data.approvedAt && (
              <p className="mt-3 text-xs text-axis-core/50">
                Approved by {data.approvedBy} on {new Date(data.approvedAt).toLocaleDateString("en-US")}
              </p>
            )}
          </div>

          <div className="rounded-card border border-axis-base/30 bg-white p-5">
            <p className="text-sm font-semibold text-axis-core">Details</p>
            <div className="mt-4 flex flex-col gap-4">
              <label className="block">
                <span className="text-xs font-medium text-axis-core/70">Section type</span>
                <select
                  value={sectionType}
                  onChange={(e) => setSectionType(e.target.value as CommunicationSectionType)}
                  className={fieldClass()}
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
                <input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)} className={fieldClass()} />
              </label>
              {sectionType === "faq_of_month" && (
                <label className="block">
                  <span className="text-xs font-medium text-axis-core/70">FAQ notes (question + answer)</span>
                  <textarea value={faqNotes} onChange={(e) => setFaqNotes(e.target.value)} rows={3} className={fieldClass()} />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-[8px] px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      {data.history.length > 0 && (
        <div className="mt-5 rounded-card border border-axis-base/30 bg-white p-5">
          <p className="text-sm font-semibold text-axis-core">History</p>
          <ul className="mt-3 space-y-2.5">
            {data.history.map((h) => (
              <li key={h.id} className="border-t border-axis-base/20 pt-2.5 text-xs text-axis-core/60 first:border-t-0 first:pt-0">
                <span className="font-medium text-axis-core">
                  {h.fromStatus ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}` : `Created as ${STATUS_LABELS[h.toStatus]}`}
                </span>
                {" · "}
                {h.changedBy} · {new Date(h.createdAt).toLocaleString("en-US")}
                {h.notes && <p className="mt-1 text-axis-core/70">"{h.notes}"</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
