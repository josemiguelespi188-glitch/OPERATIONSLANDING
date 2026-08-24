"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";

export function NewRequestTypeForm() {
  const adminFetch = useAdminFetch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Open Request");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/request-types", {
        method: "POST",
        body: JSON.stringify({ name, description, buttonLabel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${body.error ?? "Failed to create request type."} (status ${res.status})`);
      router.push(`/admin/forms/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request type.");
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/admin/forms" className="text-sm text-axis-core/50 hover:text-axis-core">
        ← Back to Form Builder
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-axis-core/50">
        Internal
      </p>
      <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
        New Request Type
      </h1>
      <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
        Starts inactive and with no fields. Add fields on the next screen, then activate it
        when it&rsquo;s ready.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-lg rounded-card border border-axis-base/30 bg-white p-6"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-axis-core/80">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wire Update Request"
            className="w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
            Card description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Shown on the homepage card."
            className="w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-axis-core/80">
            Submit button label
          </span>
          <input
            value={buttonLabel}
            onChange={(e) => setButtonLabel(e.target.value)}
            className="w-full rounded-[8px] border border-axis-base/50 bg-white px-3.5 py-2.5 text-sm text-axis-core placeholder:text-axis-core/35 focus:border-axis-signal focus:outline-none focus:ring-2 focus:ring-axis-signal/50"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex w-full items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create & add fields"}
        </button>
      </form>
    </div>
  );
}
