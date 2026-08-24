"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import type { RequestTypeSummary } from "@/lib/dynamicForms/types";

export function FormBuilderList() {
  const adminFetch = useAdminFetch();
  const [types, setTypes] = useState<RequestTypeSummary[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/request-types");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${body.error ?? "Failed to load request types."} (status ${res.status})`);
      setTypes(body.requestTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request types.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(type: RequestTypeSummary) {
    setBusyId(type.id);
    try {
      await adminFetch(`/api/admin/request-types/${type.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !type.isActive }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(type: RequestTypeSummary) {
    if (!confirm(`Delete "${type.name}"? This removes all its fields too.`)) return;
    setBusyId(type.id);
    try {
      const res = await adminFetch(`/api/admin/request-types/${type.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-axis-core/50">
            Internal
          </p>
          <h1 className="mt-1 font-head text-2xl font-medium tracking-tight text-axis-core">
            Form Builder
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-axis-core/60">
            Manage request types and their fields. Locked (code-driven) types let you edit
            question copy and add new questions — changes apply to the live form immediately.
            Non-locked types are still a work in progress: saved here, but not yet rendered on
            the live site.
          </p>
        </div>
        <Link
          href="/admin/forms/new"
          className="inline-flex shrink-0 items-center justify-center rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90"
        >
          New Request Type
        </Link>
      </div>

      {error && (
        <p className="mt-6 rounded-[8px] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        {types === null && !error && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">Loading...</p>
        )}
        {types?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-axis-core/50">No request types yet.</p>
        )}
        {types?.map((type, i) => (
          <div
            key={type.id}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${
              i !== 0 ? "border-t border-axis-base/20" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-axis-core">{type.name}</p>
                {type.isLocked && <Badge tone="locked">Locked · code-driven</Badge>}
                {!type.isLocked && type.usesDynamicForm && (
                  <Badge tone={type.isActive ? "active" : "inactive"}>
                    {type.isActive ? "Active" : "Inactive"}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-axis-core/50">
                /{type.slug} · {type.fieldCount} field{type.fieldCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {type.isLocked ? (
                <Link
                  href={`/admin/forms/${type.id}`}
                  className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core"
                >
                  Edit copy
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleActive(type)}
                    disabled={busyId === type.id}
                    className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-50"
                  >
                    {type.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <Link
                    href={`/admin/forms/${type.id}`}
                    className="rounded-[6px] border border-axis-base/50 px-3 py-1.5 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(type)}
                    disabled={busyId === type.id}
                    className="rounded-[6px] border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "locked" | "active" | "inactive"; children: React.ReactNode }) {
  const styles = {
    locked: "bg-axis-base/40 text-axis-core",
    active: "bg-axis-signal text-axis-core",
    inactive: "bg-axis-light text-axis-core/60",
  } as const;

  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}
