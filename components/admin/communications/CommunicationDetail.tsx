"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import {
  SECTION_TYPE_LABELS,
  STATUS_LABELS,
  type Client,
  type CommunicationSectionType,
  type CommunicationStatus,
  type CommunicationStatusHistoryEntry,
  type CommunicationSummary,
  type RecipientType,
} from "@/lib/communications/types";

type Detail = CommunicationSummary & {
  history: CommunicationStatusHistoryEntry[];
  recipientClientIds: string[];
};

const SECTION_TYPES: CommunicationSectionType[] = [
  "section_1",
  "section_2",
  "faq_of_month",
  "full_communication",
];

const STATUS_PANEL_COLOR: Record<CommunicationStatus, string> = {
  building: "bg-axis-light text-axis-core",
  pending_approval: "bg-axis-signal/40 text-axis-core",
  changes_requested: "bg-red-100 text-red-700",
  ready_for_launch: "bg-green-100 text-green-700",
  deployed: "bg-axis-core text-white",
};

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

  useEffect(() => {
    load();
    loadClients();
  }, [load, loadClients]);

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

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Untitled communication"
        className="mt-2 w-full rounded-[6px] border border-dashed border-axis-base/50 bg-transparent px-2 py-1 font-head text-2xl font-medium tracking-tight text-axis-core outline-none transition-colors hover:border-axis-core/40 hover:bg-axis-light/40 focus:border-axis-core focus:border-solid focus:bg-white"
      />

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: the email itself -- the big ClickUp-style content pane */}
        <div className="rounded-card border border-axis-base/30 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className={sectionLabel()}>Email</p>
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
                View HTML
              </button>
            </div>
          </div>

          {htmlTab === "visual" ? (
            htmlCode.trim() ? (
              <iframe
                srcDoc={htmlCode}
                sandbox=""
                title="Email preview"
                className="mt-3 h-[640px] w-full rounded-[8px] border border-axis-base/50 bg-white"
              />
            ) : (
              <div className="mt-3 flex h-[640px] flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-axis-base/50 text-sm text-axis-core/40">
                <p>No HTML yet</p>
                <button
                  type="button"
                  onClick={() => setHtmlTab("code")}
                  className="rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90"
                >
                  View HTML to paste it in
                </button>
              </div>
            )
          ) : (
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              spellCheck={false}
              placeholder="Paste the email's HTML code here..."
              className="mt-3 h-[640px] w-full rounded-[8px] border border-axis-base/50 bg-axis-light/30 p-3 font-mono text-xs leading-relaxed text-axis-core outline-none focus:border-axis-core"
            />
          )}
        </div>

        {/* Right: everything you can do with it -- ClickUp-style property panel */}
        <div className="flex flex-col gap-5">
          <div className={`rounded-card border border-axis-base/30 p-5 ${STATUS_PANEL_COLOR[data.status]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">Status</p>
            <p className="mt-1 font-head text-lg font-bold">{STATUS_LABELS[data.status]}</p>

            {data.status === "building" && (
              <div className="mt-3">
                <button
                  type="button"
                  disabled={statusBusy || !canSendForApproval}
                  onClick={() => setStatus("pending_approval")}
                  className="w-full rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
                >
                  Send for approval
                </button>
                {!canSendForApproval && (
                  <p className="mt-2 text-xs opacity-70">Add the HTML before sending for approval.</p>
                )}
              </div>
            )}

            {data.status === "pending_approval" && !showApprove && !showRequestChanges && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowApprove(true)}
                  className="rounded-[8px] bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestChanges(true)}
                  className="rounded-[8px] border border-axis-core/30 px-4 py-2.5 text-sm font-semibold text-axis-core hover:bg-white/40"
                >
                  Request changes
                </button>
              </div>
            )}

            {showApprove && (
              <div className="mt-3 rounded-[8px] bg-white/70 p-4">
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
                    className="rounded-[8px] px-4 py-2 text-xs font-semibold text-axis-core/60 hover:bg-white/40"
                  >
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
                    className="rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequestChanges(false)}
                    className="rounded-[8px] px-4 py-2 text-xs font-semibold text-axis-core/60 hover:bg-white/40"
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
                className="mt-3 w-full rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
              >
                Back to Building (edit and resend)
              </button>
            )}

            {data.status === "ready_for_launch" && (
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => setStatus("deployed")}
                className="mt-3 w-full rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
              >
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
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === "all_investors"}
                  onChange={() => setRecipientType("all_investors")}
                />
                All investors
              </label>
              <label className="flex items-center gap-2 text-sm text-axis-core">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === "specific"}
                  onChange={() => setRecipientType("specific")}
                />
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
                  <button
                    type="button"
                    onClick={handleAddClient}
                    disabled={!newClientName.trim() || addingClient}
                    className="rounded-[8px] bg-axis-core px-3 py-1.5 text-xs font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
                  >
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
          <p className={sectionLabel()}>History</p>
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
