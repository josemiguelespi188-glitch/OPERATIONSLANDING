"use client";

import { useState } from "react";

/**
 * The "+" quick-create flow: just a title and an optional send date
 * (pre-filled when opened from a calendar day click). Everything else
 * -- the HTML itself, section type, FAQ notes -- is filled in on the
 * detail page right after creating, so this stays a one-field modal
 * instead of a full form.
 */
export function QuickCreateModal({
  initialDate,
  onClose,
  onCreate,
}: {
  initialDate: string | null;
  onClose: () => void;
  onCreate: (title: string, sendDate: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [sendDate, setSendDate] = useState(initialDate ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      await onCreate(title.trim(), sendDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the communication.");
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-axis-core/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card bg-white p-5 shadow-modal">
        <p className="text-sm font-semibold text-axis-core">New communication</p>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-axis-core/70">Title</span>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Nov 2026 – How we protect your investment"'
            required
            className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-axis-core/70">Send date (optional)</span>
          <input
            type="date"
            value={sendDate}
            onChange={(e) => setSendDate(e.target.value)}
            className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm outline-none focus:border-axis-core"
          />
        </label>

        {error && <p className="mt-3 rounded-[8px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] px-4 py-2 text-sm font-medium text-axis-core/60 hover:bg-axis-light"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="rounded-[8px] bg-axis-core px-4 py-2 text-sm font-semibold text-white hover:bg-axis-core/90 disabled:opacity-40"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
