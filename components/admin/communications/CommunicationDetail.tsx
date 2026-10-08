"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import {
  SECTION_TYPE_LABELS,
  STATUS_LABELS,
  type Approver,
  type Client,
  type CommunicationComment,
  type CommunicationSectionType,
  type CommunicationStatus,
  type CommunicationStatusHistoryEntry,
  type CommunicationSummary,
  type RecipientType,
} from "@/lib/communications/types";

type Detail = CommunicationSummary & {
  history: CommunicationStatusHistoryEntry[];
  comments: CommunicationComment[];
  recipientClientIds: string[];
};

type TimelineEntry =
  | { kind: "comment"; id: string; createdAt: string; author: string; body: string }
  | { kind: "status"; id: string; createdAt: string; author: string | null; fromStatus: CommunicationStatus | null; toStatus: CommunicationStatus; notes: string | null };

const SECTION_TYPES: CommunicationSectionType[] = [
  "section_1",
  "section_2",
  "faq_of_month",
  "full_communication",
];
const ALL_STATUSES: CommunicationStatus[] = [
  "building",
  "pending_approval",
  "changes_requested",
  "ready_for_launch",
  "deployed",
];

const STATUS_PANEL_COLOR: Record<CommunicationStatus, string> = {
  building: "bg-axis-light text-axis-core",
  pending_approval: "bg-axis-signal/40 text-axis-core",
  changes_requested: "bg-red-100 text-red-700",
  ready_for_launch: "bg-green-100 text-green-700",
  deployed: "bg-axis-core text-white",
};

/** Solid dark buttons: yellow fill on hover, across the whole Communications section. */
const PRIMARY_BTN =
  "rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-signal hover:text-axis-core disabled:opacity-40 disabled:hover:bg-axis-core disabled:hover:text-white";
/** Outline/secondary buttons: yellow tint on hover. */
const SECONDARY_BTN =
  "rounded-[8px] border border-axis-base/50 px-4 py-2 text-sm font-semibold text-axis-core transition-colors hover:border-axis-signal hover:bg-axis-signal/25";
const TEXT_BTN = "rounded-[8px] px-3 py-2 text-xs font-semibold text-axis-core/60 transition-colors hover:bg-axis-signal/25 hover:text-axis-core";

function fieldClass() {
  return "mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core";
}

function sectionLabel() {
  return "text-[11px] font-semibold uppercase tracking-wide text-axis-core/45";
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

  const [recipientType, setRecipientType] = useState<RecipientType>("all_investors");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);

  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [newApproverName, setNewApproverName] = useState("");
  const [newApproverEmail, setNewApproverEmail] = useState("");
  const [addingApprover, setAddingApprover] = useState(false);

  const [selectedApproverId, setSelectedApproverId] = useState("");
  const [showSendForApproval, setShowSendForApproval] = useState(false);
  const [sendForApprovalMode, setSendForApprovalMode] = useState<"team" | "once">("team");
  const [onceApproverName, setOnceApproverName] = useState("");
  const [onceApproverEmail, setOnceApproverEmail] = useState("");
  const [approverChoiceId, setApproverChoiceId] = useState("");
  const [showApprove, setShowApprove] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [changesComment, setChangesComment] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

  const [newCommentBody, setNewCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

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
      setRecipientType(body.recipientType);
      setSelectedClientIds(body.recipientClientIds ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this communication.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadClients = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/clients");
      const body = await res.json().catch(() => ({}));
      if (res.ok) setClients(body.clients ?? []);
    } catch {
      // Non-fatal -- the Recipients section just shows an empty list.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadApprovers = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/approvers");
      const body = await res.json().catch(() => ({}));
      if (res.ok) setApprovers(body.approvers ?? []);
    } catch {
      // Non-fatal -- the pickers just show an empty list.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    loadClients();
    loadApprovers();
  }, [load, loadClients, loadApprovers]);

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
          recipientType,
          clientIds: recipientType === "specific" ? selectedClientIds : [],
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

  /** Title saves the instant you click away, ClickUp-style -- not gated behind the big Save button below. */
  async function handleTitleBlur() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === data?.title) return;
    try {
      const res = await adminFetch(`/api/admin/communications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save the title.");
      setData((d) => (d ? { ...d, title: trimmed } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the title.");
    }
  }

  async function handleAddClient() {
    const name = newClientName.trim();
    if (!name) return;
    setAddingClient(true);
    try {
      const res = await adminFetch("/api/admin/clients", { method: "POST", body: JSON.stringify({ name }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not add the client.");
      const client: Client = body.client;
      setClients((prev) => (prev.some((c) => c.id === client.id) ? prev : [...prev, client].sort((a, b) => a.name.localeCompare(b.name))));
      setSelectedClientIds((prev) => (prev.includes(client.id) ? prev : [...prev, client.id]));
      setNewClientName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the client.");
    } finally {
      setAddingClient(false);
    }
  }

  function toggleClient(clientId: string) {
    setSelectedClientIds((prev) => (prev.includes(clientId) ? prev.filter((id2) => id2 !== clientId) : [...prev, clientId]));
  }

  async function handleAddApprover(selectAfter: (id: string) => void) {
    const name = newApproverName.trim();
    const email = newApproverEmail.trim();
    if (!name || !email) return;
    setAddingApprover(true);
    try {
      const res = await adminFetch("/api/admin/approvers", { method: "POST", body: JSON.stringify({ name, email }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not add the approver.");
      const approver: Approver = body.approver;
      setApprovers((prev) => (prev.some((a) => a.id === approver.id) ? prev : [...prev, approver].sort((a, b) => a.name.localeCompare(b.name))));
      selectAfter(approver.id);
      setNewApproverName("");
      setNewApproverEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the approver.");
    } finally {
      setAddingApprover(false);
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
      setShowSendForApproval(false);
      setSendForApprovalMode("team");
      setOnceApproverName("");
      setOnceApproverEmail("");
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

  function handleManualStatusChange(newStatus: CommunicationStatus) {
    if (!data || newStatus === data.status) return;
    setStatus(newStatus, { manualOverride: true });
  }

  function handleConfirmSendForApproval() {
    if (sendForApprovalMode === "once") {
      const name = onceApproverName.trim();
      const email = onceApproverEmail.trim();
      if (!name || !email) return;
      setStatus("pending_approval", { approverName: name, approverEmail: email });
      return;
    }
    const approver = approvers.find((a) => a.id === selectedApproverId);
    if (!approver) return;
    setStatus("pending_approval", { approverName: approver.name, approverEmail: approver.email });
  }

  function handleConfirmApprove() {
    const approver = approvers.find((a) => a.id === approverChoiceId);
    if (!approver) return;
    setStatus("ready_for_launch", { approvedBy: approver.name });
  }

  async function handlePostComment() {
    const text = newCommentBody.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const res = await adminFetch(`/api/admin/communications/${id}/comments`, {
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
    <div>
      <Link href="/admin/communications" className={`inline-block ${TEXT_BTN}`}>
        ← Communications
      </Link>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Untitled communication"
        className="mt-2 w-full rounded-[6px] border border-dashed border-axis-base/50 bg-transparent px-2 py-1 font-head text-2xl font-medium tracking-tight text-axis-core outline-none transition-colors hover:border-axis-core/40 hover:bg-axis-light/40 focus:border-axis-core focus:border-solid focus:bg-white"
      />

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.9fr_0.9fr]">
        {/* Left: the email itself, capped at a realistic email width */}
        <div className="rounded-card border border-axis-base/30 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className={sectionLabel()}>Email</p>
            <div className="flex rounded-[8px] border border-axis-base/50 p-0.5">
              <button
                type="button"
                onClick={() => setHtmlTab("visual")}
                className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-colors ${htmlTab === "visual" ? "bg-axis-core text-white" : "text-axis-core/60 hover:bg-axis-signal/30 hover:text-axis-core"}`}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setHtmlTab("code")}
                className={`rounded-[6px] px-3 py-1 text-xs font-semibold transition-colors ${htmlTab === "code" ? "bg-axis-core text-white" : "text-axis-core/60 hover:bg-axis-signal/30 hover:text-axis-core"}`}
              >
                View HTML
              </button>
            </div>
          </div>

          {htmlTab === "visual" ? (
            htmlCode.trim() ? (
              <div className="mx-auto mt-3 w-full max-w-[640px]">
                <iframe
                  srcDoc={htmlCode}
                  sandbox=""
                  title="Email preview"
                  className="h-[640px] w-full rounded-[8px] border border-axis-base/50 bg-white"
                />
              </div>
            ) : (
              <div className="mx-auto mt-3 flex h-[640px] w-full max-w-[640px] flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-axis-base/50 text-sm text-axis-core/40">
                <p>No HTML yet</p>
                <button type="button" onClick={() => setHtmlTab("code")} className={PRIMARY_BTN}>
                  View HTML to paste it in
                </button>
              </div>
            )
          ) : (
            <div className="mx-auto mt-3 w-full max-w-[640px]">
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                spellCheck={false}
                placeholder="Paste the email's HTML code here..."
                className="h-[640px] w-full rounded-[8px] border border-axis-base/50 bg-axis-light/30 p-3 font-mono text-xs leading-relaxed text-axis-core outline-none focus:border-axis-core"
              />
            </div>
          )}
        </div>

        {/* Middle: everything you can do with it */}
        <div className="flex flex-col gap-5">
          <div className={`rounded-card border border-axis-base/30 p-5 ${STATUS_PANEL_COLOR[data.status]}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">Status</p>
              <select
                value={data.status}
                onChange={(e) => handleManualStatusChange(e.target.value as CommunicationStatus)}
                disabled={statusBusy}
                className="rounded-[6px] border border-current/20 bg-white/50 px-2 py-1 text-[11px] font-semibold text-axis-core outline-none"
                title="Change status manually (bypasses the guided approval steps)"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 font-head text-lg font-bold">{STATUS_LABELS[data.status]}</p>

            {data.status === "building" && !showSendForApproval && (
              <div className="mt-3">
                <button
                  type="button"
                  disabled={statusBusy || !canSendForApproval}
                  onClick={() => setShowSendForApproval(true)}
                  className={`w-full ${PRIMARY_BTN}`}
                >
                  Send for approval
                </button>
                {!canSendForApproval && (
                  <p className="mt-2 text-xs opacity-70">Add the HTML before sending for approval.</p>
                )}
              </div>
            )}

            {showSendForApproval && (
              <div className="mt-3 rounded-[8px] bg-white/70 p-4">
                <p className="text-xs font-semibold text-axis-core">Request approval from</p>

                <div className="mt-2 flex gap-1 rounded-[8px] bg-axis-base/20 p-1">
                  <button
                    type="button"
                    onClick={() => setSendForApprovalMode("team")}
                    className={`flex-1 rounded-[6px] py-1.5 text-xs font-semibold transition-colors ${
                      sendForApprovalMode === "team" ? "bg-white text-axis-core shadow-sm" : "text-axis-core/60 hover:text-axis-core"
                    }`}
                  >
                    From the team
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendForApprovalMode("once")}
                    className={`flex-1 rounded-[6px] py-1.5 text-xs font-semibold transition-colors ${
                      sendForApprovalMode === "once" ? "bg-white text-axis-core shadow-sm" : "text-axis-core/60 hover:text-axis-core"
                    }`}
                  >
                    Someone else (one time)
                  </button>
                </div>

                {sendForApprovalMode === "team" ? (
                  <>
                    <div className="mt-3 flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                      {approvers.length === 0 && <p className="text-xs text-axis-core/50">No approvers saved yet -- add one below.</p>}
                      {approvers.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm text-axis-core">
                          <input
                            type="radio"
                            name="sendForApprovalChoice"
                            checked={selectedApproverId === a.id}
                            onChange={() => setSelectedApproverId(a.id)}
                          />
                          {a.name} <span className="text-xs text-axis-core/50">{a.email}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={newApproverName}
                        onChange={(e) => setNewApproverName(e.target.value)}
                        placeholder="Name"
                        className="min-w-0 flex-1 rounded-[8px] border border-axis-base/50 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-axis-core"
                      />
                      <input
                        type="email"
                        value={newApproverEmail}
                        onChange={(e) => setNewApproverEmail(e.target.value)}
                        placeholder="Email"
                        className="min-w-0 flex-1 rounded-[8px] border border-axis-base/50 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-axis-core"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddApprover(setSelectedApproverId)}
                        disabled={!newApproverName.trim() || !newApproverEmail.trim() || addingApprover}
                        className={SECONDARY_BTN}
                      >
                        Add
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-axis-core/45">Added here, this person is saved to the team list for next time.</p>
                  </>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={onceApproverName}
                        onChange={(e) => setOnceApproverName(e.target.value)}
                        placeholder="Name"
                        className="min-w-0 flex-1 rounded-[8px] border border-axis-base/50 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-axis-core"
                      />
                      <input
                        type="email"
                        value={onceApproverEmail}
                        onChange={(e) => setOnceApproverEmail(e.target.value)}
                        placeholder="Email"
                        className="min-w-0 flex-1 rounded-[8px] border border-axis-base/50 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-axis-core"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-axis-core/45">Not saved -- just for this one request.</p>
                  </>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={
                      statusBusy ||
                      (sendForApprovalMode === "team" ? !selectedApproverId : !onceApproverName.trim() || !onceApproverEmail.trim())
                    }
                    onClick={handleConfirmSendForApproval}
                    className={PRIMARY_BTN}
                  >
                    Send request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendForApproval(false);
                      setSendForApprovalMode("team");
                      setOnceApproverName("");
                      setOnceApproverEmail("");
                    }}
                    className={TEXT_BTN}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {data.status === "pending_approval" && !showApprove && !showRequestChanges && (
              <div className="mt-3">
                {data.requestedApproverName && (
                  <p className="mb-2 text-xs opacity-70">Requested from {data.requestedApproverName}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setShowApprove(true)} className="rounded-[8px] bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-signal hover:text-axis-core">
                    Approve
                  </button>
                  <button type="button" onClick={() => setShowRequestChanges(true)} className={SECONDARY_BTN}>
                    Request changes
                  </button>
                </div>
              </div>
            )}

            {showApprove && (
              <div className="mt-3 rounded-[8px] bg-white/70 p-4">
                <p className="text-xs font-semibold text-axis-core">Who is approving?</p>
                <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto">
                  {approvers.length === 0 && <p className="text-xs text-axis-core/50">No approvers saved yet.</p>}
                  {approvers.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-axis-core">
                      <input type="radio" name="approver" checked={approverChoiceId === a.id} onChange={() => setApproverChoiceId(a.id)} />
                      {a.name}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={statusBusy || !approverChoiceId}
                    onClick={handleConfirmApprove}
                    className="rounded-[8px] bg-green-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-axis-signal hover:text-axis-core disabled:opacity-40"
                  >
                    Confirm approval
                  </button>
                  <button type="button" onClick={() => setShowApprove(false)} className={TEXT_BTN}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showRequestChanges && (
              <div className="mt-3 rounded-[8px] bg-white/70 p-4">
                <p className="text-xs font-semibold text-axis-core">What needs to change?</p>
                <textarea
                  value={changesComment}
                  onChange={(e) => setChangesComment(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-[8px] border border-axis-base/50 bg-white px-3 py-2 text-sm text-axis-core outline-none focus:border-axis-core"
                  placeholder="Describe what Annelise should fix before resending..."
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={statusBusy || !changesComment.trim()}
                    onClick={() => setStatus("changes_requested", { comment: changesComment })}
                    className={PRIMARY_BTN}
                  >
                    Send
                  </button>
                  <button type="button" onClick={() => setShowRequestChanges(false)} className={TEXT_BTN}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {data.status === "changes_requested" && (
              <button type="button" disabled={statusBusy} onClick={() => setStatus("building")} className={`mt-3 w-full ${PRIMARY_BTN}`}>
                Back to Building (edit and resend)
              </button>
            )}

            {data.status === "ready_for_launch" && (
              <button type="button" disabled={statusBusy} onClick={() => setStatus("deployed")} className={`mt-3 w-full ${PRIMARY_BTN}`}>
                Mark as Deployed
              </button>
            )}

            {data.status === "deployed" && <p className="mt-3 text-xs opacity-70">This communication has been deployed.</p>}

            {data.approvedAt && (
              <p className="mt-3 text-xs opacity-70">
                Approved by {data.approvedBy} on {new Date(data.approvedAt).toLocaleDateString("en-US")}
              </p>
            )}
          </div>

          <div className="rounded-card border border-axis-base/30 bg-white p-5">
            <p className={sectionLabel()}>Recipients</p>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-axis-core">
                <input type="radio" name="recipientType" checked={recipientType === "all_investors"} onChange={() => setRecipientType("all_investors")} />
                All investors
              </label>
              <label className="flex items-center gap-2 text-sm text-axis-core">
                <input type="radio" name="recipientType" checked={recipientType === "specific"} onChange={() => setRecipientType("specific")} />
                Specific clients
              </label>
            </div>

            {recipientType === "specific" && (
              <div className="mt-3 rounded-[8px] border border-axis-base/40 p-3">
                {clients.length === 0 && <p className="text-xs text-axis-core/50">No clients saved yet.</p>}
                <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                  {clients.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-axis-core">
                      <input type="checkbox" checked={selectedClientIds.includes(c.id)} onChange={() => toggleClient(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddClient();
                      }
                    }}
                    placeholder="Add a client name..."
                    className="min-w-0 flex-1 rounded-[8px] border border-axis-base/50 px-2.5 py-1.5 text-sm outline-none focus:border-axis-core"
                  />
                  <button type="button" onClick={handleAddClient} disabled={!newClientName.trim() || addingClient} className={SECONDARY_BTN}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-card border border-axis-base/30 bg-white p-5">
            <p className={sectionLabel()}>Details</p>
            <div className="mt-4 flex flex-col gap-4">
              <label className="block">
                <span className="text-xs font-medium text-axis-core/70">Section type</span>
                <select value={sectionType} onChange={(e) => setSectionType(e.target.value as CommunicationSectionType)} className={fieldClass()}>
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
            <button type="button" onClick={handleSave} disabled={saving} className={PRIMARY_BTN}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-[8px] px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Right: comments + status history, merged into one timeline */}
        <div className="rounded-card border border-axis-base/30 bg-white p-5">
          <p className={sectionLabel()}>Comments</p>
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              rows={2}
              placeholder="Add a comment..."
              className="w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={!newCommentBody.trim() || postingComment}
              className={`self-start ${SECONDARY_BTN}`}
            >
              {postingComment ? "Posting..." : "Post comment"}
            </button>
          </div>

          <div className="mt-4 max-h-[600px] space-y-3 overflow-y-auto">
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
      </div>
    </div>
  );
}
