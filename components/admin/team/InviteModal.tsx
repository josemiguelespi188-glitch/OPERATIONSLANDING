"use client";

import { useState } from "react";

export function InviteModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (email: string, fullName: string, role: "admin" | "super_admin") => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError("");
    try {
      await onInvite(email.trim(), fullName.trim(), role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the invite.");
      setSending(false);
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
        <p className="text-sm font-semibold text-axis-core">Invite a coworker</p>
        <p className="mt-1 text-xs text-axis-core/50">
          They&rsquo;ll get an email with a link to set their own password and sign in.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-axis-core/70">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coworker@axiskey.com"
            className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-axis-core/70">Full name (optional)</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-axis-core/70">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "super_admin")}
            className="mt-1 w-full rounded-[8px] border border-axis-base/50 px-3 py-2 text-sm text-axis-core focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </label>

        {error && <p className="mt-3 rounded-[6px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-axis-base/50 px-3.5 py-2 text-sm font-semibold text-axis-core transition-colors hover:border-axis-core"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="rounded-[8px] bg-axis-core px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
