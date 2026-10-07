"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { SaReviewSubNav } from "./SaReviewSubNav";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SaKnowledgeBaseManager() {
  const adminFetch = useAdminFetch();
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/sa-review/knowledge");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load the knowledge base.");
      setEntries(body.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the knowledge base.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeChars = (entries ?? [])
    .filter((e) => e.isActive)
    .reduce((sum, e) => sum + e.title.length + e.content.length + 10, 0);

  async function handleAdd() {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are both required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/sa-review/knowledge", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to save the entry.");
      setTitle("");
      setContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the entry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(entry: KnowledgeEntry) {
    setBusyId(entry.id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/knowledge/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !entry.isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update the entry.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the entry.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this knowledge base entry?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/sa-review/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete the entry.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the entry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <SaReviewSubNav active="knowledge" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">Internal</p>
        <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
          Knowledge Base
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
          Keep feeding the reviewer new rules, corrections, and edge cases as the team finds them.
          Every active entry below is automatically added to every future review -- no code change
          needed. Deactivate an entry instead of deleting it to keep it around without using it.
        </p>
      </div>

      <div className="mt-8 rounded-card border border-axis-base/30 bg-white p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={'Short title (e.g. "Trust accounts need two signatures")'}
          className="w-full rounded-[6px] border border-axis-base/50 px-3 py-2 text-sm text-axis-core placeholder:text-axis-core/40 focus:border-axis-core focus:outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What should the reviewer know or do differently?"
          rows={4}
          className="mt-3 w-full rounded-[6px] border border-axis-base/50 px-3 py-2 text-sm text-axis-core placeholder:text-axis-core/40 focus:border-axis-core focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            disabled={saving}
            onClick={handleAdd}
            className="inline-flex items-center justify-center rounded-[8px] bg-axis-core px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add entry"}
          </button>
          <p className="text-xs text-axis-core/40">
            Active entries: ~{activeChars.toLocaleString()} / 6,000 characters sent per review
          </p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-8 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {entries === null && !error && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">Loading...</p>
        )}
        {entries?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">No entries yet.</p>
        )}
        {entries?.map((entry, i) => (
          <div
            key={entry.id}
            className={`px-5 py-4 ${i !== 0 ? "border-t border-axis-base/20" : ""} ${
              entry.isActive ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-axis-core">{entry.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-axis-core/70">{entry.content}</p>
                <p className="mt-1.5 text-xs text-axis-core/40">
                  Updated {new Date(entry.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyId === entry.id}
                  onClick={() => handleToggle(entry)}
                  className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-50"
                >
                  {entry.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  disabled={busyId === entry.id}
                  onClick={() => handleDelete(entry.id)}
                  className="rounded-[6px] border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
